import { ModelEntry, QuotaKind } from './modelRegistry';

export type FeatureId =
  | 'dictation' // dictée audio enregistrée + structuration
  | 'dictation-live' // transcription temps réel streaming
  | 'text-analysis' // structuration et ratures de texte tapé au clavier
  | 'factcheck' // vérification sourcée avec groundingSearch
  | 'tts' // lecture vocale de chapitre (Gemini TTS)
  | 'cover-generation' // illustration de couverture (Nano Banana Pro / Imagen 3)
  | 'translation' // traduction littéraire en direct
  | 'deep-research' // recherche documentaire et historique approfondie multi-sources
  | 'global-analysis'; // analyse critique et cohérence narrative multi-chapitres

export interface FeatureRequirement {
  requiredCapability: ModelEntry['capabilities'][number];
  requiredQuotaKind: QuotaKind;
  degradeInsteadOfFallback: boolean;
  chain: string[]; // IDs des modèles dans l'ordre strict de préférence et performance
}

export const FEATURE_CHAINS: Record<FeatureId, FeatureRequirement> = {
  // 1. Transcription audio enregistrée (modèles dédiés STT de pointe)
  dictation: {
    requiredCapability: 'text',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'gemini-3.5-transcribe', // Modèle dédié ultra-précis pour fichiers audio
      'gemini-3.6-flash', // Modèle Flash haute vitesse et stable
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-flash-lite',
    ],
  },

  // 2. Transcription audio en streaming direct
  'dictation-live': {
    requiredCapability: 'live-audio',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'gemini-3.5-transcribe-live', // Modèle dédié streaming temps réel
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash-native-audio-dialog',
      'gemini-2.5-flash',
    ],
  },

  // 3. Analyse stylistique, ratures et structuration de texte
  'text-analysis': {
    requiredCapability: 'text',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'gemini-3.6-flash', // Modèle Flash de référence (< 1s, support JSON natif vérifié)
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-3.1-pro',
      'gemini-2.5-flash-lite',
    ],
  },

  // 4. Fact-checking sourcé avec Grounding Google Search
  factcheck: {
    requiredCapability: 'text',
    requiredQuotaKind: 'groundingSearch',
    degradeInsteadOfFallback: true,
    chain: [
      'gemini-2.5-flash', // Meilleur quota Grounding Search (1500 RPD)
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro',
      'gemini-2.5-pro',
    ],
  },

  // 5. Synthèse vocale multimodale (TTS)
  tts: {
    requiredCapability: 'tts',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: true,
    chain: [
      'gemini-3.1-flash-tts', // Modèle TTS rapide et expressif
      'gemini-2.5-pro-tts', // TTS haute fidélité
      'gemini-2.5-flash-tts',
      'gemini-3.7-flash',
    ],
  },

  // 6. Génération d'illustrations de couverture
  'cover-generation': {
    requiredCapability: 'image',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: true,
    chain: [
      'nano-banana-pro', // Gemini 3 Pro Image — Haute fidélité couverture
      'nano-banana-2', // Gemini 3.1 Flash Image
      'nano-banana-2-lite',
      'imagen-3.0-generate-002',
    ],
  },

  // 7. Traduction littéraire
  translation: {
    requiredCapability: 'translate',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'gemini-3.5-live-translate', // Modèle dédié traduction en direct
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ],
  },

  // 8. Recherche documentaire approfondie & dossiers de contexte
  'deep-research': {
    requiredCapability: 'research',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'deep-research-max-preview-04-2026', // SOTA recherche exhaustive & context gathering
      'deep-research-preview-04-2026', // Recherche rapide & context gathering
      'gemini-3.7-flash', // Fallback avec Google Search
      'gemini-3.1-pro',
      'gemini-2.5-pro',
    ],
  },

  // 9. Analyse globale et raisonnement narratif
  'global-analysis': {
    requiredCapability: 'text',
    requiredQuotaKind: 'generation',
    degradeInsteadOfFallback: false,
    chain: [
      'deep-research-max-preview-04-2026', // Analyse globale multi-chapitres
      'deep-research-preview-04-2026',
      'gemini-3.1-pro', // Raisonnement littéraire profond
      'gemini-2.5-pro',
      'gemini-3.7-flash',
    ],
  },
};
