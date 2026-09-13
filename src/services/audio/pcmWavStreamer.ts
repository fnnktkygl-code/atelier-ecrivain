/**
 * PCM to WAV Streaming Audio Processor
 *
 * Captures raw audio via Web Audio API (ScriptProcessorNode / AudioContext),
 * downsamples to 16kHz mono (optimal for speech recognition), and generates
 * valid standalone WAV slices at regular intervals for real-time live streaming STT.
 */

export class PcmWavStreamer {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private totalSamples = 0;
  private isStreaming = false;

  startWithSource(source: MediaStreamAudioSourceNode, audioContext: AudioContext): void {
    try {
      this.audioContext = audioContext;
      this.source = source;
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      // Use standard 4096 buffer size for broad mobile WebKit / Android support
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.pcmChunks = [];
      this.totalSamples = 0;
      this.isStreaming = true;

      this.processor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        this.pcmChunks.push(copy);
        this.totalSamples += copy.length;
      };

      this.source.connect(this.processor);
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.processor.connect(muteGain);
      muteGain.connect(this.audioContext.destination);
    } catch (err) {
      console.warn('[PcmWavStreamer] startWithSource échoué:', err);
    }
  }

  start(stream: MediaStream, audioContext?: AudioContext | null): void {
    try {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const AudioContextClass = win?.AudioContext || win?.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = audioContext || new AudioContextClass();
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.startWithSource(this.source, this.audioContext);
    } catch (err) {
      console.warn('[PcmWavStreamer] Initialisation échouée:', err);
    }
  }

  getCurrentWavBlob(): Blob | null {
    if (!this.audioContext || this.pcmChunks.length === 0 || this.totalSamples < 8000) {
      return null;
    }

    try {
      // 1. Merge all PCM chunks
      const merged = new Float32Array(this.totalSamples);
      let offset = 0;
      for (const chunk of this.pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // 2. Downsample to 16,000 Hz for optimal STT
      const inputRate = this.audioContext.sampleRate || 44100;
      const downsampled = downsampleBuffer(merged, inputRate, 16000);

      // 3. Encode to standard 16-bit PCM WAV
      return encodePcmToWav(downsampled, 16000);
    } catch (err) {
      console.warn('[PcmWavStreamer] Erreur encodage WAV:', err);
      return null;
    }
  }

  stop(): Blob | null {
    this.isStreaming = false;
    const finalBlob = this.getCurrentWavBlob();

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }

    this.pcmChunks = [];
    this.totalSamples = 0;
    return finalBlob;
  }
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number = 16000): Float32Array {
  if (inputRate === targetRate || inputRate < targetRate) return buffer;
  const ratio = inputRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : buffer[offsetBuffer] || 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function encodePcmToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // 'RIFF' chunk descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');

  // 'fmt ' sub-chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true);  // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // 'data' sub-chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit linear PCM audio samples
  let byteOffset = 44;
  for (let i = 0; i < samples.length; i++, byteOffset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
