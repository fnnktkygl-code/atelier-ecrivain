import { getFirebaseApp } from '@/services/firebase/config';
import { selectModel } from '../router/selectModel';
import { recordUsage } from '../router/recordUsage';

let aiModule: typeof import('firebase/ai') | null = null;

async function getAIModule() {
  if (!aiModule) {
    aiModule = await import('firebase/ai');
  }
  return aiModule;
}

export interface TTSResponse {
  audioBlobUrl?: string;
  degraded: boolean;
  error?: string;
}

export async function generateChapterSpeech(text: string): Promise<TTSResponse> {
  const selection = await selectModel('tts');

  if (!selection.modelId) {
    return {
      degraded: true,
      error: 'Quota de synthèse vocale épuisé pour aujourd’hui.',
    };
  }

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
    const app = getFirebaseApp();
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const model = getGenerativeModel(ai, {
      model: selection.modelId,
      generationConfig: {
        responseMimeType: 'audio/mp3',
      },
    });

    const response = await model.generateContent(`Lisez le texte littéraire suivant à voix haute avec un ton clair, captivant et naturel :\n\n${text.slice(0, 8000)}`);
    await recordUsage(selection.modelId, 'generation', 'success');

    const candidate = response.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0] as any;

    if (part && part.inlineData && part.inlineData.data) {
      const base64Audio = part.inlineData.data;
      const binary = atob(base64Audio);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'audio/mp3' });
      return {
        audioBlobUrl: URL.createObjectURL(blob),
        degraded: selection.degraded,
      };
    }

    return {
      degraded: true,
      error: 'Le format audio retourné par le modèle n’est pas lisible.',
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Quota exceeded')
    ) {
      await recordUsage(selection.modelId, 'generation', 'quota-error');
    }
    return {
      degraded: true,
      error: 'Synthèse vocale indisponible actuellement.',
    };
  }
}
