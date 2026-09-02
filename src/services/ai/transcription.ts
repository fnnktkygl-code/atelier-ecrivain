/**
 * Gemini AI Service — Transcription & Structuration
 *
 * Utilise la pile Gemini AI Studio (Google AI Developer API) avec les derniers modèles spécialisés 2026 :
 * 1. Gemini 3.5 Transcribe / Transcribe Live pour l'audio et la dictée vocale
 * 2. Gemini 3.7 Flash pour l'analyse stylistique et les ratures
 * 3. Gemini 2.5 Flash avec Grounding Google Search pour le fact-checking
 */

import { getGeminiAIStudio, isGeminiConfigured, formatGeminiError } from './geminiClient';
import { SYSTEM_PROMPT_TRANSCRIPTION } from './prompts';
import type { AIStructuredOutput, VerificationItem } from '@/types/manuscript';
import { selectModel } from '../ai-router/router/selectModel';
import { recordUsage } from '../ai-router/router/recordUsage';
import { recordApiRequest } from './quotaTracker';
import { verifyTextFactCheck } from '../ai-router/services/factCheck';
import { FEATURE_CHAINS, FeatureId } from '../ai-router/types/featureChains';
import type { GenerativeModel } from '@google/generative-ai';

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
  execute: (model: GenerativeModel, modelName: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  const genAI = getGeminiAIStudio();

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
      const model = genAI.getGenerativeModel({
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
      console.warn(
        `[Gemini AI Studio Fallback] Le modèle ${modelName} a échoué (${errMsg}). Basculement vers le modèle suivant dans la chaîne...`
      );
      await recordUsage(modelName, 'generation', 'quota-error');
      continue;
    }
  }

  throw new Error(formatGeminiError(lastError || `Tous les modèles de la chaîne ${feature} ont échoué.`));
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

export async function transcribeAudio(
  audioBlob: Blob,
  context?: { currentChapter?: number; previousContent?: string }
): Promise<TranscriptionResult> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "Clé Gemini AI Studio non configurée. Ajoutez NEXT_PUBLIC_GEMINI_API_KEY dans votre environnement ou vos paramètres."
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
        console.log(`[Gemini AI Studio Dictation] Modèle : ${modelName}`);
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
  if (!isGeminiConfigured()) {
    throw new Error("Clé Gemini AI Studio non configurée. Ajoutez NEXT_PUBLIC_GEMINI_API_KEY.");
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
        console.log(`[Gemini AI Studio Text Analysis] Modèle : ${modelName}`);
      }
      const apiResult = await model.generateContent([contextPrompt]);
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
  if (!isGeminiConfigured()) {
    throw new Error("Clé Gemini AI Studio non configurée.");
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
        console.log(`[Gemini AI Studio Stream] Modèle : ${modelName}`);
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
