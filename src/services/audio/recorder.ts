import { PcmWavStreamer } from './pcmWavStreamer';

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds
  level: number; // 0-1 audio level
  maxDuration: number; // seconds (default 150s = 2min30)
}

export interface RecorderCallbacks {
  onStateChange: (state: RecorderState) => void;
  onComplete: (blob: Blob, duration: number, finalWavBlob?: Blob | null) => void;
  onError: (error: string) => void;
  onProgressiveAudio?: (blob: Blob, duration: number) => void;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private pcmStreamer = new PcmWavStreamer();
  private chunks: Blob[] = [];
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private callbacks: RecorderCallbacks;
  public readonly maxDuration: number;
  private state: RecorderState;

  constructor(callbacks: RecorderCallbacks, maxDuration: number = 150) {
    this.callbacks = callbacks;
    this.maxDuration = maxDuration;
    this.state = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      level: 0,
      maxDuration: this.maxDuration,
    };
  }

  async start(): Promise<void> {
    try {
      // 1. SYNCHRONOUS AudioContext creation in direct user activation gesture (crucial for iOS Safari)
      try {
        const win = typeof window !== 'undefined' ? (window as any) : null;
        const AudioContextClass = win?.AudioContext || win?.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
        }
      } catch (acErr) {
        console.warn('[AudioRecorder] AudioContext init synchrone:', acErr);
      }

      // 2. Request microphone access with progressive fallback
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr) {
        console.warn('[AudioRecorder] Contraintes audio avancées refusées, repli basique:', constraintErr);
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Ensure AudioContext is running after getUserMedia
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      // 3. Connect SINGLE MediaStreamAudioSourceNode to both analyser and pcmStreamer
      if (this.stream && this.audioContext) {
        try {
          const sourceNode = this.audioContext.createMediaStreamSource(this.stream);

          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          sourceNode.connect(this.analyser);

          // Connect pcmStreamer to the SAME sourceNode (prevents WebKit InvalidStateError)
          this.pcmStreamer.startWithSource(sourceNode, this.audioContext);
        } catch (sourceErr) {
          console.warn('[AudioRecorder] Erreur source audio (non bloquant):', sourceErr);
        }
      }

      // Determine best supported MIME type
      const mimeType = this.getBestMimeType();

      // Create recorder defensively (iOS Safari can reject audioBitsPerSecond)
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          ...(mimeType ? { mimeType } : {}),
          audioBitsPerSecond: 128000,
        });
      } catch {
        try {
          this.mediaRecorder = new MediaRecorder(this.stream, {
            ...(mimeType ? { mimeType } : {}),
          });
        } catch {
          this.mediaRecorder = new MediaRecorder(this.stream);
        }
      }

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const finalWav = this.pcmStreamer.stop();
        const actualMime = this.mediaRecorder?.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: actualMime });
        if (blob.size === 0 && (!finalWav || finalWav.size === 0)) {
          this.callbacks.onError('Enregistrement audio vide. Veuillez vérifier les autorisations de votre micro.');
        } else {
          // If mediaRecorder produced an empty blob (can happen on some iOS WebViews), fallback to finalWav
          const reliableBlob = blob.size > 0 ? blob : finalWav!;
          this.callbacks.onComplete(reliableBlob, this.state.duration, finalWav);
        }
        this.cleanup();
      };

      this.mediaRecorder.onerror = () => {
        this.callbacks.onError('Erreur pendant l\'enregistrement.');
        this.cleanup();
      };

      // Start recording
      // CRITICAL FOR SAFARI / MP4:
      // Passing timeslice (e.g. 1000) causes WebKit on iOS/macOS to chop MP4 into corrupt chunks.
      // Starting without timeslice produces one clean, well-formed container upon stop.
      const actualType = this.mediaRecorder.mimeType || mimeType || '';
      const isSafariOrMp4 =
        actualType.includes('mp4') ||
        actualType.includes('aac') ||
        (typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent));

      if (isSafariOrMp4) {
        this.mediaRecorder.start();
      } else {
        this.mediaRecorder.start(1000); // collect data every second on Chrome/Firefox
      }
      this.startTime = Date.now();

      // Timer
      this.timerInterval = setInterval(() => {
        if (!this.state.isPaused) {
          const currentDuration = Math.floor((Date.now() - this.startTime) / 1000);
          this.state.duration = currentDuration;
          this.emitState();

          // Progressive audio slice for live streaming STT every 2 seconds
          if (currentDuration >= 2 && currentDuration % 2 === 0) {
            try {
              const wavBlob = this.pcmStreamer.getCurrentWavBlob();
              if (wavBlob && wavBlob.size > 8000) {
                this.callbacks.onProgressiveAudio?.(wavBlob, currentDuration);
              }
            } catch (err) {
              console.warn('[AudioRecorder] Erreur extraction WAV progressif:', err);
            }
          }

          if (currentDuration >= this.maxDuration) {
            console.log('[AudioRecorder] Durée maximale atteinte (150s), finalisation automatique...');
            this.stop();
          }
        }
      }, 1000);

      // Level monitoring
      this.levelInterval = setInterval(() => {
        if (this.analyser) {
          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
          this.state.level = Math.min(1, avg / 128);
          this.emitState();
        }
      }, 100);

      this.state = { isRecording: true, isPaused: false, duration: 0, level: 0, maxDuration: this.maxDuration };
      this.emitState();
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Accès au microphone refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.'
          : 'Impossible d\'accéder au microphone.';
      this.callbacks.onError(msg);
    }
  }

  pause(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.state.isPaused = true;
      this.emitState();
    }
  }

  resume(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      this.state.isPaused = false;
      this.emitState();
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        if (typeof this.mediaRecorder.requestData === 'function') {
          this.mediaRecorder.requestData();
        }
      } catch {}
      this.mediaRecorder.stop();
    }
    this.state.isRecording = false;
    this.state.isPaused = false;
    this.emitState();
  }

  cancel(): void {
    this.pcmStreamer.stop();
    if (this.mediaRecorder) {
      this.mediaRecorder.onstop = null; // Do not trigger onComplete callback
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.pcmStreamer.stop();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.levelInterval) clearInterval(this.levelInterval);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.mediaRecorder = null;
    this.stream = null;
    this.analyser = null;
    this.audioContext = null;
    this.state = { isRecording: false, isPaused: false, duration: 0, level: 0, maxDuration: this.maxDuration };
  }

  private emitState(): void {
    this.callbacks.onStateChange({ ...this.state });
  }

  private getBestMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
      }
    }
    return '';
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  }
}
