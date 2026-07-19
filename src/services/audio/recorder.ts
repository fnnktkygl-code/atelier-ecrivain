/**
 * Audio Recorder Service
 * Capture audio via MediaRecorder API with level monitoring.
 */

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds
  level: number; // 0-1 audio level
}

export interface RecorderCallbacks {
  onStateChange: (state: RecorderState) => void;
  onComplete: (blob: Blob, duration: number) => void;
  onError: (error: string) => void;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private callbacks: RecorderCallbacks;
  private state: RecorderState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    level: 0,
  };

  constructor(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000, // Optimal for speech recognition
        },
      });

      // Set up audio analysis for level monitoring
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Determine best supported MIME type
      const mimeType = this.getBestMimeType();

      // Create recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        this.callbacks.onComplete(blob, this.state.duration);
        this.cleanup();
      };

      this.mediaRecorder.onerror = () => {
        this.callbacks.onError('Erreur pendant l\'enregistrement.');
        this.cleanup();
      };

      // Start recording
      this.mediaRecorder.start(1000); // collect data every second
      this.startTime = Date.now();

      // Timer
      this.timerInterval = setInterval(() => {
        if (!this.state.isPaused) {
          this.state.duration = Math.floor((Date.now() - this.startTime) / 1000);
          this.emitState();
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

      this.state = { isRecording: true, isPaused: false, duration: 0, level: 0 };
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
      this.mediaRecorder.stop();
    }
    this.state.isRecording = false;
    this.state.isPaused = false;
    this.emitState();
  }

  private cleanup(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.levelInterval) clearInterval(this.levelInterval);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.mediaRecorder = null;
    this.stream = null;
    this.analyser = null;
    this.audioContext = null;
    this.state = { isRecording: false, isPaused: false, duration: 0, level: 0 };
  }

  private emitState(): void {
    this.callbacks.onStateChange({ ...this.state });
  }

  private getBestMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm'; // fallback
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
  }
}
