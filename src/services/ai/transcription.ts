/**
 * Gemini AI Service — Transcription & Structuration
 *
 * Utilise Firebase AI Logic / Gemini Developer API avec les derniers modèles spécialisés 2026 :
 * 1. Gemini 3.5 Transcribe / Transcribe Live pour l'audio et la dictée vocale
 * 2. Gemini 3.7 Flash pour l'analyse stylistique et les ratures
 * 3. Gemini 2.5 Flash avec Grounding Google Search pour le fact-checking
 */

import { getFirebaseApp, isFirebaseConfigured } from '@/services/firebase/config';
import { SYSTEM_PROMPT_TRANSCRIPTION } from './prompts';
import type { AIStructuredOutput, VerificationItem } from '@/types/manuscript';
import { selectModel } from '../ai-router/router/selectModel';
import { recordUsage } from '../ai-router/router/recordUsage';
import { recordApiRequest } from './quotaTracker';
import { verifyTextFactCheck } from '../ai-router/services/factCheck';
import { FEATURE_CHAINS, FeatureId } from '../ai-router/types/featureChains';

// Lazy-loaded Firebase AI imports
let aiModule: typeof import('firebase/ai') | null = null;

async function getAIModule() {
  if (!aiModule) {
    aiModule = await import('firebase/ai');
  }
  return aiModule;
}

export interface TranscriptionResult {
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
 * Execute a Gemini AI operation with automatic fallback on quota/rate-limit error using AI Router
 */
async function generateWithFallback<T>(
  generationConfig: Record<string, unknown>,
  systemInstruction: string,
  feature: FeatureId,
  execute: (model: unknown, modelName: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
  const app = getFirebaseApp();
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const selection = await selectModel(feature);
  const fallbackChain = FEATURE_CHAINS[feature]?.chain || [
    'gemini-3.5-transcribe',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
  ];
  const chain = selection.modelId
    ? [selection.modelId, ...fallbackChain.filter((m) => m !== selection.modelId)]
    : fallbackChain;

  let lastError: unknown = null;

  for (const modelName of chain) {
    try {
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: generationConfig as never,
        systemInstruction,
      });

      const res = await execute(model, modelName);
      await recordUsage(modelName, 'generation', 'success');
      return { result: res, modelUsed: modelName };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const isQuotaOrNotFound =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('404') ||
        errMsg.includes('not found') ||
        errMsg.includes('is not supported');

      if (isQuotaOrNotFound) {
        await recordUsage(modelName, 'generation', 'quota-error');
        console.warn(`[AI Fallback] Modèle ${modelName} indisponible ou quota atteint pour ${feature}. Basculement...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`Tous les modèles de la chaîne ${feature} ont échoué.`);
}

// ── Rate Limiter ──
const requestTimestamps: number[] = [];

function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= 30) {
    throw new Error('Limite de requêtes atteinte (max 30 requêtes / minute). Veuillez patienter quelques secondes.');
  }
  requestTimestamps.push(now);
}

interface RawModelClient {
  generateContent: (content: unknown[]) => Promise<{
    response: { text: () => string };
  }>;
  generateContentStream: (content: unknown[]) => Promise<{
    stream: AsyncIterable<{ text: () => string }>;
  }>;
}

export async function transcribeAudio(
  audioBlob: Blob,
  context?: { currentChapter?: number; previousContent?: string }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase n'est pas configuré. Ajoutez votre config dans .env.local"
    );
  }

  checkRateLimit();
  recordApiRequest();

  const audioBase64 = await blobToBase64(audioBlob);

  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` L'auteur poursuit la rédaction de son chapitre en cours (Chapitre ${context.currentChapter + 1}). Tout le texte dicté doit venir À LA SUITE de ce chapitre. Ne crée PAS de nouveau chapitre.`;
  }
  if (context?.previousContent) {
    contextPrompt += ` Voici le contexte du texte précédent pour maintenir la continuité : « ${context.previousContent.slice(-500)} »`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    'dictation',
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Dictation] Exécution avec le modèle spécialisé : ${modelName}`);
      }
      const typedModel = model as RawModelClient;
      const apiResult = await typedModel.generateContent([
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

export async function factCheck(text: string): Promise<VerificationItem[]> {
  const res = await verifyTextFactCheck(text);
  return res.verifications;
}

/**
 * Analyze text written via keyboard (ratures, corrections, factcheck, notes)
 */
export async function analyzeWrittenText(
  text: string,
  context?: { currentChapter?: number }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase n'est pas configuré. Ajoutez votre configuration dans .env.local");
  }

  checkRateLimit();
  recordApiRequest();

  let contextPrompt = `Analyse et structure ce texte rédigé au clavier par l'auteur. Extrais les ratures/suggestions d'amélioration de style, les éléments à vérifier (fact-check), les notes explicatives de marge et les idées flottantes :\n\n« ${text} »`;

  if (context?.currentChapter !== undefined) {
    contextPrompt += `\nChapitre en cours : Chapitre ${context.currentChapter + 1}.`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    'text-analysis',
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Text Analysis] Exécution avec le modèle : ${modelName}`);
      }
      const typedModel = model as RawModelClient;
      const apiResult = await typedModel.generateContent([contextPrompt]);
      const responseText = apiResult.response.text();
      try {
        return JSON.parse(responseText) as TranscriptionResult;
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TranscriptionResult;
        }
        throw new Error('Impossible de parser la réponse de Gemini. Réponse : ' + responseText.slice(0, 200));
      }
    }
  );

  return { ...result, modelUsed };
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
    throw new Error("Firebase n'est pas configuré.");
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
    'dictation-live',
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AI Stream] Exécution avec le modèle streaming : ${modelName}`);
      }
      const typedModel = model as RawModelClient;
      const streamResult = await typedModel.generateContentStream([
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
