import { ModelEntry, QuotaKind } from './modelRegistry';

export type FeatureId =
  | 'dictation' // dictée + structuration, priorité qualité
  | 'factcheck' // vérification sourcée, DOIT avoir groundingSearch
  | 'tts' // lecture vocale de chapitre
  | 'cover-generation' // génération d'image de couverture
  | 'translation' // traduction littéraire
  | 'global-analysis'; // relecture de cohérence sur plusieurs chapitres

export interface FeatureRequirement {
  requiredCapability: ModelEntry['capabilities'][number];
  requiredQuotaKind: QuotaKind;
  degradeInsteadOfFallback: boolean;
  chain: string[]; // ids de ModelEntry dans l'ordre de priorité
}

export const FEATURE_CHAINS: Record<FeatureId, FeatureRequirement> = {
  dictation: {
    requiredCapability: 'text',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ],
  },
  factcheck: {
    requiredCapability: 'text',
    requiredQuotaKind: 'groundingSearch',
    degradeInsteadOfFallback: true, // Si pas de grounding disponible -> degrader en 'unverified'
    chain: ['gemini-2.5-flash', 'gemini-flash-latest'],
  },
  tts: {
    requiredCapability: 'tts',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: true,
    chain: ['gemini-2.5-flash-tts', 'gemini-3.1-flash-tts'],
  },
  'cover-generation': {
    requiredCapability: 'image',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: true,
    chain: [
      'imagen-4-fast-generate',
      'imagen-4-generate',
      'imagen-4-ultra-generate',
    ],
  },
  translation: {
    requiredCapability: 'translate',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: ['gemini-3.5-live-translate', 'gemini-3.5-flash'],
  },
  'global-analysis': {
    requiredCapability: 'text',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'],
  },
};
