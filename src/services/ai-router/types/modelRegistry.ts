export type QuotaKind = 'generation' | 'groundingSearch' | 'groundingMaps';

export interface ModelQuotaLimits {
  rpm: number | null; // null = illimité
  rpd: number | null;
  tpm: number | null;
}

export interface ModelEntry {
  id: string; // ex. 'gemini-3.6-flash'
  family:
    | 'gemini-2'
    | 'gemini-2.5'
    | 'gemini-3'
    | 'gemini-3.1'
    | 'gemini-3.5'
    | 'gemini-3.6'
    | 'imagen-4'
    | 'gemma-4'
    | 'embedding';
  capabilities: ('text' | 'tts' | 'image' | 'live-audio' | 'translate')[];
  quotas: Partial<Record<QuotaKind, ModelQuotaLimits>>;
  knownUnavailable?: boolean;
}

/**
 * Registre des modèles Gemini et leurs quotas connus (audit 2026-07-23).
 * Les limites sont auto-déclarées et ajustables sans casser l'architecture du routeur.
 */
export const MODEL_REGISTRY: ModelEntry[] = [
  {
    id: 'gemini-3.6-flash',
    family: 'gemini-3.6',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 5, rpd: 20, tpm: 250000 },
      groundingSearch: { rpm: 0, rpd: 0, tpm: 0 },
      groundingMaps: { rpm: 0, rpd: 0, tpm: 0 },
    },
  },
  {
    id: 'gemini-3.5-flash',
    family: 'gemini-3.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 5, rpd: 20, tpm: 250000 },
      groundingSearch: { rpm: 0, rpd: 0, tpm: 0 },
      groundingMaps: { rpm: 0, rpd: 0, tpm: 0 },
    },
  },
  {
    id: 'gemini-2.5-flash',
    family: 'gemini-2.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 5, rpd: 20, tpm: 250000 },
      groundingSearch: { rpm: 10, rpd: 1500, tpm: 250000 },
      groundingMaps: { rpm: 10, rpd: 500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-3.1-flash-lite',
    family: 'gemini-3.1',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 15, rpd: 500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-3.5-flash-lite',
    family: 'gemini-3.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 15, rpd: 500, tpm: 250000 },
    },
  },
  {
    id: 'gemini-2.5-flash-tts',
    family: 'gemini-2.5',
    capabilities: ['tts'],
    quotas: {
      generation: { rpm: 3, rpd: 10, tpm: 10000 },
    },
  },
  {
    id: 'gemini-3.1-flash-tts',
    family: 'gemini-3.1',
    capabilities: ['tts'],
    quotas: {
      generation: { rpm: 3, rpd: 10, tpm: 10000 },
    },
  },
  {
    id: 'gemini-3.5-live-translate',
    family: 'gemini-3.5',
    capabilities: ['translate'],
    quotas: {
      generation: { rpm: null, rpd: null, tpm: 20000 },
    },
  },
  {
    id: 'imagen-4-fast-generate',
    family: 'imagen-4',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: null, rpd: 25, tpm: null },
    },
  },
  {
    id: 'imagen-4-generate',
    family: 'imagen-4',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: null, rpd: 25, tpm: null },
    },
  },
  {
    id: 'imagen-4-ultra-generate',
    family: 'imagen-4',
    capabilities: ['image'],
    quotas: {
      generation: { rpm: null, rpd: 25, tpm: null },
    },
  },
  {
    id: 'gemini-flash-latest',
    family: 'gemini-2.5',
    capabilities: ['text'],
    quotas: {
      generation: { rpm: 15, rpd: 1500, tpm: 250000 },
    },
  },
];
