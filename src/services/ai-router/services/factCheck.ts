import { getFirebaseApp } from '@/services/firebase/config';
import { SYSTEM_PROMPT_FACTCHECK } from '@/services/ai/prompts';
import type { VerificationItem } from '@/types/manuscript';
import { selectModel } from '../router/selectModel';
import { recordUsage } from '../router/recordUsage';

let aiModule: typeof import('firebase/ai') | null = null;

async function getAIModule() {
  if (!aiModule) {
    aiModule = await import('firebase/ai');
  }
  return aiModule;
}

export interface FactCheckResponse {
  verifications: VerificationItem[];
  searchEntryPointHtml?: string; // Widget d'attribution Google Search obligatoire
  isGrounded: boolean;
}

export async function verifyTextFactCheck(text: string): Promise<FactCheckResponse> {
  const selection = await selectModel('factcheck');

  if (!selection.modelId || selection.reason === 'no-grounding-available') {
    return {
      verifications: [
        {
          text: 'Vérification factuelle non disponible (Quota de recherche Google épuisé pour la journée).',
          status: 'unverified',
          suggestion: 'Réessayez demain ou après la réinitialisation des quotas Pacifique.',
        },
      ],
      isGrounded: false,
    };
  }

  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await getAIModule();
    const app = getFirebaseApp();
    const ai = getAI(app, { backend: new GoogleAIBackend() });

    const model = getGenerativeModel(ai, {
      model: selection.modelId,
      tools: [{ googleSearch: {} } as any],
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: SYSTEM_PROMPT_FACTCHECK,
    });

    const response = await model.generateContent(text);
    await recordUsage(selection.modelId, 'groundingSearch', 'success');

    const candidate = response.response.candidates?.[0];
    const groundingMetadata = (candidate as any)?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks ?? [];
    const searchEntryPoint = groundingMetadata?.searchEntryPoint?.renderedContent;

    const rawText = response.response.text();
    let parsed: VerificationItem[] = [];

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = [
        {
          text: 'Erreur lors de l’analyse de la réponse.',
          status: 'unverified',
        },
      ];
    }

    // Attach real verified source URLs from grounding chunks instead of LLM hallucination
    const realSources = groundingChunks
      .map((c: any) => c.web?.uri || c.web?.title)
      .filter(Boolean)
      .join(', ');

    const verifiedItems: VerificationItem[] = parsed.map((item) => {
      if (!groundingChunks.length) {
        return {
          ...item,
          status: 'unverified',
          source: undefined,
        };
      }
      return {
        ...item,
        source: realSources || item.source,
      };
    });

    return {
      verifications: verifiedItems,
      searchEntryPointHtml: searchEntryPoint,
      isGrounded: groundingChunks.length > 0,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Quota exceeded')
    ) {
      await recordUsage(selection.modelId, 'groundingSearch', 'quota-error');
    }

    return {
      verifications: [
        {
          text: 'Échec de la vérification en direct.',
          status: 'unverified',
          suggestion: 'Vérifiez manuellement vos sources primaires.',
        },
      ],
      isGrounded: false,
    };
  }
}
