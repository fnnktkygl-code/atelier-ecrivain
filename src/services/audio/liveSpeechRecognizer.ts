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
  // Accumulated text from previous sessions (when restarting on silence)
  private baseText = '';
  // Confirmed final text in the current session
  private currentSessionFinal = '';
  // Tentative interim text in the current session
  private currentSessionInterim = '';

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

      this.baseText = '';
      this.currentSessionFinal = '';
      this.currentSessionInterim = '';

      this.recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        // Standard W3C Web Speech API:
        // In continuous mode, event.results is the full chronological array of results for this recognition session.
        // We evaluate index 0..length in a single pass to cleanly separate finalized from interim tokens.
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          if (res.isFinal) {
            sessionFinal += res[0].transcript + ' ';
          } else {
            sessionInterim += res[0].transcript;
          }
        }

        this.currentSessionFinal = sessionFinal.trim();
        this.currentSessionInterim = sessionInterim.trim();

        const confirmedPart = [this.baseText, this.currentSessionFinal].filter(Boolean).join(' ');
        const fullStreamedText = [confirmedPart, this.currentSessionInterim].filter(Boolean).join(' ');

        if (fullStreamedText) {
          this.onChunk(fullStreamedText, Boolean(this.currentSessionFinal && !this.currentSessionInterim));
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
          // If the recognition paused/ended (due to silence on mobile WebKit/Chrome),
          // commit the current session's text into baseText before the new session resets event.results.
          const sessionDone = [this.currentSessionFinal, this.currentSessionInterim].filter(Boolean).join(' ').trim();
          if (sessionDone) {
            this.baseText = [this.baseText, sessionDone].filter(Boolean).join(' ').trim();
          }
          this.currentSessionFinal = '';
          this.currentSessionInterim = '';

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
    const sessionDone = [this.currentSessionFinal, this.currentSessionInterim].filter(Boolean).join(' ').trim();
    const fullText = [this.baseText, sessionDone].filter(Boolean).join(' ').trim();

    this.baseText = '';
    this.currentSessionFinal = '';
    this.currentSessionInterim = '';
    return fullText;
  }

  cancel(): void {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.baseText = '';
    this.currentSessionFinal = '';
    this.currentSessionInterim = '';
  }
}
