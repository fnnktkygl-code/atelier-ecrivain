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

export interface CoverGenResponse {
  imageUrl?: string;
  degraded: boolean;
  error?: string;
}

export async function generateAICoverImage(prompt: string): Promise<CoverGenResponse> {
  const selection = await selectModel('cover-generation');

  if (!selection.modelId) {
    return {
      degraded: true,
      error: 'Quota de génération d’images Imagen 4 épuisé pour la journée (25/jour).',
    };
  }

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
    const app = getFirebaseApp();
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const model = getGenerativeModel(ai, {
      model: selection.modelId,
    });

    const response = await model.generateContent(`Create a high quality book cover illustration: ${prompt}`);
    await recordUsage(selection.modelId, 'generation', 'success');

    const candidate = response.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0] as any;

    if (part && part.inlineData && part.inlineData.data) {
      const base64Img = part.inlineData.data;
      const mime = part.inlineData.mimeType || 'image/jpeg';
      return {
        imageUrl: `data:${mime};base64,${base64Img}`,
        degraded: selection.degraded,
      };
    }

    return {
      degraded: true,
      error: 'Aucune image générée retournée.',
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
      error: 'Erreur lors de la génération de la couverture par IA.',
    };
  }
}
