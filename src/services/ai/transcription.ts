/**
 * Gemini AI Service — Transcription & Structuration
 *
 * Uses Firebase AI Logic (Gemini Developer API) to:
 * 1. Transcribe audio dictation into structured manuscript
 * 2. Fact-check citations and historical references
 */

import { getFirebaseApp, isFirebaseConfigured } from '@/services/firebase/config';
import { SYSTEM_PROMPT_TRANSCRIPTION, SYSTEM_PROMPT_FACTCHECK } from './prompts';
import type { AIStructuredOutput, VerificationItem } from '@/types/manuscript';

// Lazy-loaded Firebase AI imports
let aiModule: typeof import('firebase/ai') | null = null;

async function getAIModule() {
  if (!aiModule) {
    aiModule = await import('firebase/ai');
  }
  return aiModule;
}

interface TranscriptionResult {
  chapterIndex: number | null;
  chapterTitle: string | null;
  isNewChapter: boolean;
  jetBrut: string[];
  ratures: Array<{
    original: string;
    corrected: string;
    explanation: string;
    uncertainty: 'low' | 'medium' | 'high';
  }>;
  corrections: VerificationItem[];
  notes: Record<string, string>;
  floatingNotes: string[];
  summary: string;
  modelUsed?: string;
}

/**
 * Convert an audio Blob to base64 for Gemini
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Prioritized list of Gemini models for automatic fallback.
 * 1. Primary high-performance models (3.6 Flash -> 3.5 Flash)
 * 2. High-quota fallback model (3.5 Flash Lite — 500 RPD)
 * 3. General alias fallback (gemini-flash-latest)
 */
const MODEL_FALLBACK_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
];

/**
 * Execute a Gemini AI operation with automatic fallback on quota/rate-limit error
 */
async function generateWithFallback<T>(
  generationConfig: any,
  systemInstruction: string,
  execute: (model: any, modelName: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
  const app = getFirebaseApp();
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig,
        systemInstruction,
      });

      const res = await execute(model, modelName);
      return { result: res, modelUsed: modelName };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isQuotaOrNotFound =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('is not supported');

      if (isQuotaOrNotFound) {
        console.warn(`[AI Fallback] Modèle ${modelName} indisponible ou quota atteint (${errMsg}). Basculement vers le modèle suivant...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Tous les modèles Gemini de la chaîne de secours ont échoué.');
}

/**
 * Transcribe and structure an audio recording using Gemini
 */
// ── Rate Limiter ──
const requestTimestamps: number[] = [];

function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= 10) {
    throw new Error('Limite de requêtes atteinte (max 10 dictées / minute). Veuillez patienter quelques secondes.');
  }
  requestTimestamps.push(now);
}

import { recordApiRequest } from './quotaTracker';

export async function transcribeAudio(
  audioBlob: Blob,
  context?: { currentChapter?: number; previousContent?: string }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase n\'est pas configuré. Ajoutez votre config dans .env.local'
    );
  }

  checkRateLimit();
  recordApiRequest();

  const audioBase64 = await blobToBase64(audioBlob);

  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` L'auteur travaille actuellement sur le chapitre ${context.currentChapter + 1}.`;
  }
  if (context?.previousContent) {
    contextPrompt += ` Voici le contexte du texte précédent pour maintenir la cohérence : « ${context.previousContent.slice(-500)} »`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Dictation] Exécution avec le modèle : ${modelName}`);
      }
      const apiResult = await model.generateContent([
        contextPrompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
          },
        },
      ]);

      const responseText = apiResult.response.text();
      try {
        return JSON.parse(responseText) as TranscriptionResult;
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TranscriptionResult;
        }
        throw new Error('Impossible de parser la réponse de Gemini. Réponse reçue : ' + responseText.slice(0, 200));
      }
    }
  );

  return { ...result, modelUsed };
}

/**
 * Fact-check a passage of text
 */
export async function factCheck(text: string): Promise<VerificationItem[]> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  const { result } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
    },
    SYSTEM_PROMPT_FACTCHECK,
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI FactCheck] Exécution avec le modèle : ${modelName}`);
      }
      const apiResult = await model.generateContent(
        `Vérifie les faits dans ce passage de manuscrit :\n\n${text}`
      );
      const responseText = apiResult.response.text();
      try {
        return JSON.parse(responseText) as VerificationItem[];
      } catch {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as VerificationItem[];
        }
        return [];
      }
    }
  );

  return result;
}

/**
 * Streaming transcription — sends audio and streams back the structured result
 */
export async function transcribeAudioStream(
  audioBlob: Blob,
  onChunk: (partialText: string) => void,
  context?: { currentChapter?: number }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  const audioBase64 = await blobToBase64(audioBlob);

  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` Chapitre en cours : ${context.currentChapter + 1}.`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Stream] Exécution avec le modèle : ${modelName}`);
      }
      const streamResult = await model.generateContentStream([
        contextPrompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
          },
        },
      ]);

      let fullText = '';
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(fullText);
      }

      try {
        return JSON.parse(fullText) as TranscriptionResult;
      } catch {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TranscriptionResult;
        }
        throw new Error('Erreur de parsing de la réponse streaming.');
      }
    }
  );

  return { ...result, modelUsed };
}

/**
 * Convert structured output to the AIStructuredOutput type used in the app
 */
export function toAIStructuredOutput(result: TranscriptionResult): AIStructuredOutput {
  return {
    jetBrut: result.jetBrut,
    ratures: result.ratures.map((r) => `**${r.original}** → ${r.corrected} _(${r.explanation})_`),
    corrections: result.corrections,
    notes: result.notes,
    floatingNotes: result.floatingNotes,
  };
}
