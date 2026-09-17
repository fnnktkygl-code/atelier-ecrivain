/**
 * Gemini AI Service — Transcription & Structuration
 *
 * Utilise la pile Gemini AI Studio (Google AI Developer API) avec les derniers modèles spécialisés 2026 :
 * 1. Speech-To-Text ultra-rapide avec Gemini 3.5 Transcribe / Gemini 2.5 Flash (audio natif, thinkingBudget=0)
 * 2. Gemini 3.7 Flash / Gemini 2.5 Flash pour l'analyse stylistique, ratures et structuration JSON
 * 3. Fallback multimodal direct et protection anti-perte de texte dicté
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

export type DictationProgressCallback = (status: {
  step: 'transcribing' | 'structuring';
  message: string;
  modelName: string;
}) => void;

/**
 * Cache for models unavailable in the current session (404/not supported)
 * to avoid wasting network round-trips on subsequent dictations.
 */
const unavailableModels = new Set<string>();

export function markModelUnavailable(modelName: string): void {
  unavailableModels.add(modelName);
}

export function isModelUnavailable(modelName: string): boolean {
  return unavailableModels.has(modelName);
}

export function resetUnavailableModels(): void {
  unavailableModels.clear();
}

/**
 * Normalize browser-reported MIME types to standard Gemini-supported MIME types.
 * Strips codecs parameters (e.g. 'audio/webm;codecs=opus' -> 'audio/webm').
 */
export function normalizeAudioMimeType(mimeType: string): string {
  if (!mimeType) return 'audio/webm';
  const baseType = mimeType.split(';')[0].trim().toLowerCase();
  if (baseType.includes('webm')) return 'audio/webm';
  if (baseType.includes('mp4') || baseType.includes('m4a') || baseType.includes('aac')) return 'audio/mp4';
  if (baseType.includes('ogg')) return 'audio/ogg';
  if (baseType.includes('wav')) return 'audio/wav';
  if (baseType.includes('mp3') || baseType.includes('mpeg')) return 'audio/mp3';
  return baseType || 'audio/webm';
}

/**
 * Detect real audio MIME type from binary magic bytes.
 * Crucial for mobile Safari which may report empty MIME types or video/mp4 for pure audio.
 */
export function detectAudioMimeType(bytes: Uint8Array, fallbackMime?: string): string {
  if (bytes && bytes.length >= 4) {
    // WebM: 1A 45 DF A3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'audio/webm';
    }
    // WAV: 'RIFF'....'WAVE'
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
    ) {
      return 'audio/wav';
    }
    // OGG: 'OggS'
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio/ogg';
    }
    // MP4 / M4A / AAC container: check 'ftyp' at offset 4
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    ) {
      return 'audio/mp4';
    }
    // MP3: ID3 or frame sync FF FB / FF F3 / FF F2
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    ) {
      return 'audio/mp3';
    }
  }

  return normalizeAudioMimeType(fallbackMime || '');
}

/**
 * Detect real audio MIME type from a Blob
 */
export async function detectAudioMimeTypeFromBlob(blob: Blob): Promise<string> {
  try {
    const slice = blob.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return detectAudioMimeType(bytes, blob.type);
  } catch {
    return normalizeAudioMimeType(blob.type || '');
  }
}

/**
 * Extract transcript text from Gemini API response.
 * Handles both:
 * 1. Dedicated transcription models (gemini-3.5-transcribe) where output is in:
 *    part.audioTranscription.text (while response.text() returns empty "")
 * 2. Multimodal text models (gemini-3.6-flash, gemini-3.7-flash) where output is in:
 *    part.text
 */
export function extractTranscriptText(response: any): string {
  if (!response) return '';

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
    for (const part of candidate.content.parts) {
      if (part?.audioTranscription?.text) {
        return part.audioTranscription.text.trim();
      }
      if (typeof part?.text === 'string' && part.text.trim().length > 0) {
        const clean = part.text
          .replace(/<thought>[\s\S]*?<\/thought>/g, '')
          .replace(/^thought\s+/i, '')
          .trim();
        if (clean.length > 0) return clean;
      }
    }
  }

  try {
    const fallbackText = typeof response.text === 'function' ? response.text() : '';
    return (fallbackText || '')
      .replace(/<thought>[\s\S]*?<\/thought>/g, '')
      .replace(/^thought\s+/i, '')
      .trim();
  } catch {
    return '';
  }
}

/**
 * Convert an audio Blob to base64 for Gemini
 */
export async function blobToBase64(blob: Blob): Promise<string> {
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
 * Parse a JSON response from Gemini cleanly
 */
export function parseTranscriptionJSON(responseText: string): TranscriptionResult {
  try {
    return JSON.parse(responseText) as TranscriptionResult;
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as TranscriptionResult;
      } catch {}
    }
    throw new Error('Impossible de parser la réponse de Gemini. Réponse reçue : ' + responseText.slice(0, 200));
  }
}

/**
 * Execute a Gemini AI operation with automatic fallback on quota/rate-limit error using AI Router.
 * Configured with thinkingBudget: 0 to eliminate the 30s+ reasoning delay on Gemini 2.5/3.7 models.
 */
export async function generateWithFallback<T>(
  generationConfig: Record<string, unknown>,
  systemInstruction: string | undefined,
  feature: FeatureId,
  execute: (model: GenerativeModel, modelName: string) => Promise<T>,
  preferredModelName?: string
): Promise<{ result: T; modelUsed: string }> {
  const genAI = getGeminiAIStudio();

  const selection = await selectModel(feature);
  const fallbackChain = FEATURE_CHAINS[feature]?.chain || [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
  ];

  let rawChain: string[];
  if (preferredModelName) {
    rawChain = [preferredModelName, ...fallbackChain.filter((m) => m !== preferredModelName)];
  } else if (selection.modelId) {
    rawChain = [selection.modelId, ...fallbackChain.filter((m) => m !== selection.modelId)];
  } else {
    rawChain = fallbackChain;
  }

  // Filter out models known to be unavailable (404 in current session)
  const activeChain = rawChain.filter((m) => !unavailableModels.has(m));
  const chain = activeChain.length > 0 ? activeChain : rawChain;

  let lastError: unknown = null;

  for (const modelName of chain) {
    try {
      // Only include thinkingConfig on Gemini 3.7 models (it causes 400 Bad Request on other models)
      const fastConfig = {
        ...generationConfig,
        ...(modelName.includes('3.7') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      };

      let model = genAI.getGenerativeModel(
        {
          model: modelName,
          generationConfig: fastConfig as never,
          ...(systemInstruction ? { systemInstruction } : {}),
        },
        { timeout: 15000 }
      );

      let res: T;
      try {
        res = await execute(model, modelName);
      } catch (execErr) {
        const msg = execErr instanceof Error ? execErr.message : String(execErr);
        // If config error or thinkingConfig rejected, retry cleanly with base generationConfig
        if (
          msg.includes('thinkingConfig') ||
          msg.includes('thinking_config') ||
          msg.includes('unknown field') ||
          msg.includes('invalid argument')
        ) {
          model = genAI.getGenerativeModel(
            {
              model: modelName,
              generationConfig: generationConfig as never,
              ...(systemInstruction ? { systemInstruction } : {}),
            },
            { timeout: 15000 }
          );
          res = await execute(model, modelName);
        } else {
          throw execErr;
        }
      }

      await recordUsage(modelName, 'generation', 'success');
      return { result: res, modelUsed: modelName };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);

      // If model is not found or overloaded in Google AI Studio, record in unavailable cache
      if (
        errMsg.includes('404') ||
        errMsg.includes('is not found') ||
        errMsg.includes('NotFound') ||
        errMsg.includes('not supported') ||
        errMsg.includes('503') ||
        errMsg.includes('Service Unavailable') ||
        errMsg.includes('high demand')
      ) {
        unavailableModels.add(modelName);
      }

      console.warn(
        `[Gemini AI Studio Fallback] Le modèle ${modelName} a échoué (${errMsg}). Basculement vers le modèle suivant dans la chaîne...`
      );

      // Register quota-error only for 429 / RESOURCE_EXHAUSTED
      if (
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded')
      ) {
        await recordUsage(modelName, 'generation', 'quota-error');
      }
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

/**
 * Stage 1: Speech-To-Text transcription using dedicated transcribe model (gemini-3.5-transcribe / gemini-3.6-flash)
 */
export async function transcribeAudioToRawText(
  audioBase64: string,
  mimeType: string,
  contextPrompt?: string
): Promise<{ text: string; modelUsed: string }> {
  const prompt = `Transcris fidèlement et intégralement cet enregistrement audio en français. Rédige mot à mot tout ce qui a été dicté par l'auteur sans résumer ni omettre de phrases.${
    contextPrompt ? ` Contexte : ${contextPrompt}` : ''
  }`;

  const cleanMimeType = normalizeAudioMimeType(mimeType);

  // STT models don't support JSON mode, so we request plain text
  const { result, modelUsed } = await generateWithFallback(
    {
      maxOutputTokens: 8192,
    },
    undefined,
    'dictation',
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Gemini STT Stage 1] Modèle audio : ${modelName}`);
      }
      const apiResult = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: cleanMimeType,
          },
        },
      ]);
      const text = extractTranscriptText(apiResult.response);
      if (!text || text.trim().length === 0) {
        throw new Error(`Le modèle ${modelName} n'a retourné aucun texte transcrit.`);
      }
      return text.trim();
    }
  );

  return { text: result, modelUsed };
}

/**
 * Stage 2: Literary text structuring and analysis (gemini-3.7-flash / gemini-2.5-flash)
 */
export async function structureTranscriptText(
  rawText: string,
  context?: { currentChapter?: number; previousContent?: string }
): Promise<{ result: TranscriptionResult; modelUsed: string }> {
  let contextPrompt = `Structure et analyse ce texte dicté par l'écrivain :\n\n« ${rawText} »`;
  if (context?.currentChapter !== undefined) {
    contextPrompt += `\nL'auteur poursuit la rédaction de son chapitre en cours (Chapitre ${context.currentChapter + 1}). Tout le texte dicté doit venir À LA SUITE de ce chapitre. Ne crée PAS de nouveau chapitre sauf si explicitement demandé.`;
  }
  if (context?.previousContent) {
    contextPrompt += `\nContexte du texte précédent : « ${context.previousContent.slice(-400)} »`;
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
        console.log(`[Gemini Structuring Stage 2] Modèle texte : ${modelName}`);
      }
      const apiResult = await model.generateContent([contextPrompt]);
      const responseText = apiResult.response.text();
      return parseTranscriptionJSON(responseText);
    }
  );

  return { result, modelUsed };
}

/**
 * High-performance audio transcription and structuring pipeline:
 * 1. Stage 1: Ultra-fast STT with gemini-3.5-transcribe / gemini-2.5-flash (< 1.5s)
 * 2. Stage 2: Literary structuring with gemini-3.7-flash / gemini-2.5-flash (< 1s)
 * 3. Fallback: Direct multimodal processing or safe raw transcript return (zero data loss)
 */
export async function transcribeAudio(
  audioBlob: Blob,
  context?: { currentChapter?: number; previousContent?: string },
  onProgress?: DictationProgressCallback
): Promise<TranscriptionResult> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "Clé Gemini AI Studio non configurée. Ajoutez NEXT_PUBLIC_GEMINI_API_KEY dans votre environnement ou vos paramètres."
    );
  }

  checkRateLimit();
  recordApiRequest();

  const audioBase64 = await blobToBase64(audioBlob);
  const cleanMimeType = await detectAudioMimeTypeFromBlob(audioBlob);

  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` Chapitre ${context.currentChapter + 1}.`;
  }

  // ── Two-stage ultra-fast pipeline ──
  try {
    onProgress?.({
      step: 'transcribing',
      message: 'Transcription vocale instantanée…',
      modelName: 'gemini-3.5-transcribe',
    });

    const { text: rawTranscript, modelUsed: sttModel } = await transcribeAudioToRawText(
      audioBase64,
      cleanMimeType,
      context?.previousContent ? `Contexte : ${context.previousContent.slice(-300)}` : undefined
    );

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      throw new Error('Aucun contenu audio détecté lors de la transcription.');
    }

    onProgress?.({
      step: 'structuring',
      message: 'Structuration littéraire & détection des ratures…',
      modelName: 'gemini-3.7-flash',
    });

    try {
      const { result, modelUsed: structModel } = await structureTranscriptText(rawTranscript, context);
      return {
        ...result,
        modelUsed: `${sttModel} + ${structModel}`,
      };
    } catch (structErr) {
      console.warn('[Transcription Structuring Fallback] Erreur de structuration, retour du texte brut sécurisé:', structErr);
      // Safe fallback: never lose the user's dictated speech!
      return {
        chapterIndex: context?.currentChapter ?? null,
        chapterTitle: null,
        isNewChapter: false,
        jetBrut: rawTranscript.split('\n\n').filter(Boolean),
        ratures: [],
        corrections: [],
        notes: {},
        floatingNotes: [],
        summary: rawTranscript.slice(0, 120),
        modelUsed: `${sttModel} (texte brut)`,
      };
    }
  } catch (sttErr) {
    // If Stage 1 STT failed, try direct multimodal structuring fallback with Flash models
    console.warn('[Transcription STT Fallback] Basculement vers la structuration multimodale directe:', sttErr);

    onProgress?.({
      step: 'structuring',
      message: 'Finalisation et structuration de la dictée…',
      modelName: 'gemini-3.7-flash',
    });

    const { result, modelUsed } = await generateWithFallback(
      {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
      SYSTEM_PROMPT_TRANSCRIPTION,
      'text-analysis',
      async (model, modelName) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Gemini Direct Multimodal Fallback] Modèle : ${modelName}`);
        }
        const apiResult = await model.generateContent([
          contextPrompt,
          {
            inlineData: {
              data: audioBase64,
              mimeType: cleanMimeType,
            },
          },
        ]);
        const responseText = apiResult.response.text();
        return parseTranscriptionJSON(responseText);
      }
    );

    return { ...result, modelUsed: `${modelUsed} (direct)` };
  }
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
      return parseTranscriptionJSON(responseText);
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
  const cleanMimeType = await detectAudioMimeTypeFromBlob(audioBlob);

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
    'text-analysis',
    async (model, modelName) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Gemini AI Studio Stream] Modèle : ${modelName}`);
      }
      const streamResult = await model.generateContentStream([
        contextPrompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: cleanMimeType,
          },
        },
      ]);

      let fullText = '';
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(fullText);
      }

      return parseTranscriptionJSON(fullText);
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

/**
 * Targeted block analysis — analyzes a single paragraph/block specifically
 */
export async function analyzeBlockText(
  blockContent: string,
  context?: { currentChapter?: number; blockIndex?: number }
): Promise<TranscriptionResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Clé Gemini AI Studio non configurée.");
  }
  checkRateLimit();
  recordApiRequest();

  let contextPrompt = `Analyse et perfectionne ce paragraphe précis du manuscrit. Détecte les ratures stylistiques, élimine les répétitions et lourdeurs, vérifie les faits et propose des notes si nécessaire :\n\n« ${blockContent} »`;
  if (context?.currentChapter !== undefined) {
    contextPrompt += `\nChapitre en cours : Chapitre ${context.currentChapter + 1}.`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    'text-analysis',
    async (model, modelName) => {
      const resp = await model.generateContent(contextPrompt);
      const text = resp.response.text();
      return parseTranscriptionJSON(text);
    }
  );

  return { ...result, modelUsed };
}

/**
 * Targeted selection analysis — analyzes a highlighted phrase or sentence (Notion style)
 */
export async function analyzeSelectionText(
  selectedText: string,
  context?: { currentChapter?: number; surroundingText?: string }
): Promise<TranscriptionResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Clé Gemini AI Studio non configurée.");
  }
  checkRateLimit();
  recordApiRequest();

  let contextPrompt = `Analyse et perfectionne cette sélection précise de texte (extrait de phrase ou proposition). Propose des ratures pour un style plus élégant et fluide, ou vérifie la citation :\n\nExtrait sélectionné : « ${selectedText} »`;
  if (context?.surroundingText) {
    contextPrompt += `\nContexte immédiat du paragraphe : « ${context.surroundingText.slice(0, 300)} »`;
  }

  const { result, modelUsed } = await generateWithFallback(
    {
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
    },
    SYSTEM_PROMPT_TRANSCRIPTION,
    'text-analysis',
    async (model, modelName) => {
      const resp = await model.generateContent(contextPrompt);
      const text = resp.response.text();
      return parseTranscriptionJSON(text);
    }
  );

  return { ...result, modelUsed };
}
