export type QuotaKind = 'generation' | 'groundingSearch' | 'groundingMaps';

export interface ModelQuotaLimits {
  rpm: number | null; // null = illimité
  rpd: number | null;
  tpm: number | null;
}

export interface ModelEntry {
  id: string; // ex. 'gemini-3.5-transcribe', 'gemini-3.7-flash', 'nano-banana-pro'
  name: string; // Nom lisible
  family:
    | 'gemini-3.7'
    | 'gemini-3.6'
    | 'gemini-3.5'
    | 'gemini-3.1'
    | 'gemini-3'
    | 'gemini-2.5'
    | 'gemini-2'
    | 'nano-banana'
    | 'imagen-3'
    | 'speech'
    | 'agent';
  capabilities: ('text' | 'tts' | 'transcribe' | 'transcribe-live' | 'image' | 'live-audio' | 'translate' | 'research')[];
  quotas: Partial<Record<QuotaKind, ModelQuotaLimits>>;
  knownUnavailable?: boolean;
}

/**
 * Registre exhaustif des modèles Google Gemini officiels de dernière génération (AI Studio 2026).
 * Spécialisé selon chaque usage éditorial :
 * - Speech-to-text : Gemini 3.5 Transcribe & Gemini 3.5 Transcribe Live
 * - Couvertures : Nano Banana Pro (Gemini 3 Pro Image), Nano Banana 2 (Gemini 3.1 Flash Image)
 * - TTS : Gemini 3.1 Flash TTS, Gemini 2.5 Pro TTS
 * - Texte & Ratures : Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash
 * - Analyse & Raisonnement : Gemini 3.1 Pro, Gemini 2.5 Pro, Deep Research Pro Preview
 * - Traduction : Gemini 3.5 Live Translate
 */
export const MODEL_REGISTRY: ModelEntry[] = [
  // ── 1. TRANSCRIPTION & SPEECH-TO-TEXT SPÉCIALISÉS ──
  {
    id: 'gemini-3.5-transcribe',
    name: 'Gemini 3.5 Transcribe',
    family: 'gemini-3.5',
    capabilities: ['transcribe', 'text'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-3.5-transcribe-live',
    name: 'Gemini 3.5 Transcribe Live',
    family: 'gemini-3.5',
    capabilities: ['transcribe-live', 'live-audio'],
    quotas: {
      generation: { rpm: 60, rpd: null, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-2.5-flash-native-audio-dialog',
    name: 'Gemini 2.5 Flash Native Audio Dialog',
    family: 'gemini-2.5',
    capabilities: ['live-audio', 'transcribe-live'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'chirp-2',
    name: 'Google Speech Chirp 2',
    family: 'speech',
    capabilities: ['transcribe', 'live-audio'],
    quotas: {
      generation: { rpm: 60, rpd: null, tpm: null },
    },
  },

  // ── 2. MODÈLES TEXTE, DICTÉE & RATURES LITTÉRAIRES ──
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    family: 'gemini-3.7',
    capabilities: ['text', 'live-audio', 'translate'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
      groundingSearch: { rpm: 10, rpd: 1500, tpm: 250000 },
      groundingMaps: { rpm: 10, rpd: 500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    family: 'gemini-3.6',
    capabilities: ['text', 'translate'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
      groundingSearch: { rpm: 10, rpd: 1500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    family: 'gemini-3.5',
    capabilities: ['text', 'translate'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    family: 'gemini-3.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    family: 'gemini-3',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    family: 'gemini-3.1',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    family: 'gemini-2.5',
    capabilities: ['text', 'live-audio', 'translate'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
      groundingSearch: { rpm: 10, rpd: 1500, tpm: 250000 },
      groundingMaps: { rpm: 10, rpd: 500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    family: 'gemini-2.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    family: 'gemini-2',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 1000000 },
    },
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    family: 'gemini-2',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 30, rpd: 1500, tpm: 1000000 },
    },
  },

  // ── 3. MODÈLES PRO & RAISONNEMENT AVANCÉ (Structure & Fact-Checking) ──
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    family: 'gemini-3.1',
    capabilities: ['text', 'translate', 'research'],
    quotas: {
      generation: { rpm: 5, rpd: 100, tpm: 500000 },
      groundingSearch: { rpm: 5, rpd: 100, tpm: 250000 },
    },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    family: 'gemini-2.5',
    capabilities: ['text', 'translate', 'research'],
    quotas: {
      generation: { rpm: 5, rpd: 100, tpm: 500000 },
      groundingSearch: { rpm: 5, rpd: 100, tpm: 250000 },
    },
  },
  {
    id: 'deep-research-pro-preview',
    name: 'Deep Research Pro Preview',
    family: 'agent',
    capabilities: ['research', 'text'],
    quotas: {
      generation: { rpm: 2, rpd: 50, tpm: 250000 },
    },
  },

  // ── 4. SYNTHÈSE VOCALE MULTIMODALE (TTS) ──
  {
    id: 'gemini-3.1-flash-tts',
    name: 'Gemini 3.1 Flash TTS',
    family: 'gemini-3.1',
    capabilities: ['tts'],
    quotas: {
      generation: { rpm: 30, rpd: 1000, tpm: 500000 },
    },
  },
  {
    id: 'gemini-2.5-pro-tts',
    name: 'Gemini 2.5 Pro TTS',
    family: 'gemini-2.5',
    capabilities: ['tts'],
    quotas: {
      generation: { rpm: 10, rpd: 500, tpm: 500000 },
    },
  },
  {
    id: 'gemini-2.5-flash-tts',
    name: 'Gemini 2.5 Flash TTS',
    family: 'gemini-2.5',
    capabilities: ['tts'],
    quotas: {
      generation: { rpm: 30, rpd: 1000, tpm: 500000 },
    },
  },

  // ── 5. GÉNÉRATION D'IMAGES & COUVERTURES DE LIVRE ──
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro (Gemini 3 Pro Image)',
    family: 'nano-banana',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: 10, rpd: 100, tpm: null },
    },
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    family: 'nano-banana',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: 15, rpd: 200, tpm: null },
    },
  },
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)',
    family: 'nano-banana',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: 30, rpd: 500, tpm: null },
    },
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana (Gemini 2.5 Flash Preview Image)',
    family: 'nano-banana',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: 15, rpd: 100, tpm: null },
    },
  },
  {
    id: 'imagen-3.0-generate-002',
    name: 'Imagen 3.0',
    family: 'imagen-3',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: null, rpd: 50, tpm: null },
    },
  },

  // ── 6. TRADUCTION LITTÉRAIRE EN DIRECT ──
  {
    id: 'gemini-3.5-live-translate',
    name: 'Gemini 3.5 Live Translate',
    family: 'gemini-3.5',
    capabilities: ['translate', 'live-audio'],
    quotas: {
      generation: { rpm: 30, rpd: 1000, tpm: 1000000 },
    },
  },
];
