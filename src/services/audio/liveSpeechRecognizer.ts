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

/**
 * Intelligently combines two speech transcripts without repeating overlapping phrases.
 * Handles:
 * 1. Exact duplicates: "quand" + "quand" -> "quand"
 * 2. Cumulative expansions (Android Web Speech bug): "quand" + "quand je" -> "quand je"
 * 3. Subset / backtracking: "quand je" + "quand" -> "quand je"
 * 4. Word-level overlapping suffix/prefix: "quand je parle ça" + "ça ne s'affiche pas" -> "quand je parle ça ne s'affiche pas"
 * 5. Phonetic revisions: "quand je par" + "quand je parle" -> "quand je parle"
 * 6. Disjoint / distinct phrases: "Bonjour" + "Comment allez-vous" -> "Bonjour Comment allez-vous"
 */
export function combineTranscripts(base: string, addition: string): string {
  const b = (base || '').trim();
  const a = (addition || '').trim();
  if (!b) return a;
  if (!a) return b;

  // Normalized versions for comparison (ignore punctuation and casing)
  const normB = b.toLowerCase().replace(/[.,!?;:«»""'']/g, ' ').replace(/\s+/g, ' ').trim();
  const normA = a.toLowerCase().replace(/[.,!?;:«»""'']/g, ' ').replace(/\s+/g, ' ').trim();

  if (normA === normB) return a;

  // If addition already contains or extends base (e.g. Android cumulative frames)
  if (normA.startsWith(normB)) {
    return a;
  }

  // If base already contains addition
  if (normB.startsWith(normA) || normB.endsWith(normA)) {
    return b;
  }

  const bWords = b.split(/\s+/).filter(Boolean);
  const aWords = a.split(/\s+/).filter(Boolean);
  const normBWords = normB.split(/\s+/).filter(Boolean);
  const normAWords = normA.split(/\s+/).filter(Boolean);

  // Check word-level overlap: does end of base match start of addition?
  const maxOverlap = Math.min(normBWords.length, normAWords.length);
  for (let k = maxOverlap; k >= 1; k--) {
    const bSlice = normBWords.slice(-k).join(' ');
    const aSlice = normAWords.slice(0, k).join(' ');
    if (bSlice === aSlice) {
      return bWords.concat(aWords.slice(k)).join(' ');
    }
  }

  // Check prefix revision: do they share leading words?
  let matchCount = 0;
  for (let i = 0; i < maxOverlap; i++) {
    if (normBWords[i] === normAWords[i]) {
      matchCount++;
    } else {
      break;
    }
  }
  // If at least 2 words match from start or >= half of base matches, addition is an in-place revision
  if (matchCount >= 2 || (matchCount >= 1 && matchCount / normBWords.length >= 0.5)) {
    return a;
  }

  // Truly distinct phrases: join with single space
  return `${b} ${a}`;
}

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
        const rawChunks: { text: string; isFinal: boolean }[] = [];
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          const text = (res[0].transcript || '').trim();
          if (text) {
            rawChunks.push({ text, isFinal: Boolean(res.isFinal) });
          }
        }

        if (rawChunks.length === 0) return;

        // Process final and interim chunks with intelligent deduplication
        let finalAccumulator = '';
        let interimAccumulator = '';

        for (const chunk of rawChunks) {
          if (chunk.isFinal) {
            finalAccumulator = combineTranscripts(finalAccumulator, chunk.text);
          } else {
            interimAccumulator = combineTranscripts(interimAccumulator, chunk.text);
          }
        }

        this.currentSessionFinal = finalAccumulator;
        this.currentSessionInterim = interimAccumulator;

        // Combine finalized and interim parts of current session
        const sessionTotal = combineTranscripts(this.currentSessionFinal, this.currentSessionInterim);

        // Combine with baseText from prior sessions
        const fullStreamedText = combineTranscripts(this.baseText, sessionTotal);

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
          const sessionDone = combineTranscripts(this.currentSessionFinal, this.currentSessionInterim);
          if (sessionDone) {
            this.baseText = combineTranscripts(this.baseText, sessionDone);
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
    const sessionDone = combineTranscripts(this.currentSessionFinal, this.currentSessionInterim);
    const fullText = combineTranscripts(this.baseText, sessionDone);

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
