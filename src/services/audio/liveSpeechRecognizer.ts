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
  private onError?: (error: string) => void;
  private accumulatedText = '';

  constructor(onChunk: LiveSpeechChunkCallback, onError?: (error: string) => void) {
    this.onChunk = onChunk;
    this.onError = onError;
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
      this.recognition.maxAlternatives = 1;
      this.accumulatedText = '';

      let currentSessionFinal = '';

      this.recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        for (let i = event.resultIndex || 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            sessionFinal += res[0].transcript + ' ';
          } else {
            sessionInterim += res[0].transcript;
          }
        }

        if (sessionFinal) {
          this.accumulatedText = (this.accumulatedText + (this.accumulatedText ? ' ' : '') + sessionFinal).trim();
        }
        currentSessionFinal = sessionFinal;

        const currentFullText = (this.accumulatedText + (this.accumulatedText && sessionInterim ? ' ' : '') + sessionInterim).trim();
        if (currentFullText) {
          this.onChunk(currentFullText, Boolean(sessionFinal && !sessionInterim));
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          this.onError?.('Permission d’accès au microphone refusée.');
        } else if (e.error === 'service-not-allowed') {
          this.onError?.('Service de reconnaissance vocale non autorisé ou indisponible.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[LiveSpeechRecognizer] Info:', e.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            setTimeout(() => {
              if (this.isListening) {
                try {
                  this.recognition?.start();
                } catch {
                  this.isListening = false;
                }
              }
            }, 80);
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
