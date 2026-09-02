/**
 * Live Speech Recognizer — Web Speech API Native
 *
 * Provides real-time interim speech-to-text directly in the browser (0ms network latency)
 * while audio recording is active.
 */

// Define SpeechRecognition type for TypeScript
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export type LiveSpeechChunkCallback = (interimText: string, isFinal: boolean) => void;

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private onChunk: LiveSpeechChunkCallback;
  private accumulatedText = '';

  constructor(onChunk: LiveSpeechChunkCallback) {
    this.onChunk = onChunk;
  }

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowSpeechRecognition;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  start(): void {
    if (!LiveSpeechRecognizer.isSupported() || this.isListening) return;

    try {
      const win = window as IWindowSpeechRecognition;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'fr-FR';
      this.accumulatedText = '';

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        if (finalChunk) {
          this.accumulatedText += finalChunk;
        }

        const currentFullText = (this.accumulatedText + interim).trim();
        if (currentFullText) {
          this.onChunk(currentFullText, Boolean(finalChunk && !interim));
        }
      };

      this.recognition.onerror = (e: any) => {
        // Silently ignore non-fatal speech recognition errors (e.g. no-speech or aborted)
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[LiveSpeechRecognizer] Info:', e.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            this.isListening = false;
          }
        }
      };

      this.recognition.start();
      this.isListening = true;
    } catch (err) {
      console.warn('[LiveSpeechRecognizer] Impossible de démarrer la reconnaissance locale:', err);
      this.isListening = false;
    }
  }

  stop(): string {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    return this.accumulatedText.trim();
  }

  cancel(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.accumulatedText = '';
  }
}
