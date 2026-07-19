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
 * Transcribe and structure an audio recording using Gemini
 */
export async function transcribeAudio(
  audioBlob: Blob,
  context?: { currentChapter?: number; previousContent?: string }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase n\'est pas configuré. Ajoutez votre config dans .env.local'
    );
  }

  const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
  const app = getFirebaseApp();
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const model = getGenerativeModel(ai, {
    model: 'gemini-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3, // Low temperature for accurate transcription
      maxOutputTokens: 8192,
    },
    systemInstruction: SYSTEM_PROMPT_TRANSCRIPTION,
  });

  // Convert audio to base64
  const audioBase64 = await blobToBase64(audioBlob);

  // Build the prompt with context
  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` L'auteur travaille actuellement sur le chapitre ${context.currentChapter + 1}.`;
  }
  if (context?.previousContent) {
    contextPrompt += ` Voici le contexte du texte précédent pour maintenir la cohérence : « ${context.previousContent.slice(-500)} »`;
  }

  const result = await model.generateContent([
    contextPrompt,
    {
      inlineData: {
        data: audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
      },
    },
  ]);

  const responseText = result.response.text();

  try {
    const parsed = JSON.parse(responseText) as TranscriptionResult;
    return parsed;
  } catch {
    // If JSON parsing fails, try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TranscriptionResult;
    }
    throw new Error('Impossible de parser la réponse de Gemini. Réponse reçue : ' + responseText.slice(0, 200));
  }
}

/**
 * Fact-check a passage of text
 */
export async function factCheck(text: string): Promise<VerificationItem[]> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
  const app = getFirebaseApp();
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const model = getGenerativeModel(ai, {
    model: 'gemini-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
    systemInstruction: SYSTEM_PROMPT_FACTCHECK,
  });

  const result = await model.generateContent(
    `Vérifie les faits dans ce passage de manuscrit :\n\n${text}`
  );

  const responseText = result.response.text();

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

/**
 * Streaming transcription — sends audio and streams back the structured result
 * (useful for showing progress during long recordings)
 */
export async function transcribeAudioStream(
  audioBlob: Blob,
  onChunk: (partialText: string) => void,
  context?: { currentChapter?: number }
): Promise<TranscriptionResult> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase n\'est pas configuré.');
  }

  const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
  const app = getFirebaseApp();
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const model = getGenerativeModel(ai, {
    model: 'gemini-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
    systemInstruction: SYSTEM_PROMPT_TRANSCRIPTION,
  });

  const audioBase64 = await blobToBase64(audioBlob);

  let contextPrompt = 'Transcris et structure cette dictée vocale.';
  if (context?.currentChapter !== undefined) {
    contextPrompt += ` Chapitre en cours : ${context.currentChapter + 1}.`;
  }

  const result = await model.generateContentStream([
    contextPrompt,
    {
      inlineData: {
        data: audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
      },
    },
  ]);

  let fullText = '';
  for await (const chunk of result.stream) {
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
