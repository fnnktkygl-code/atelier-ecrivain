import { FeatureId, FEATURE_CHAINS } from '../types/featureChains';
import { hasModelQuota } from '../quota/quotaStore';

export interface ModelSelection {
  modelId: string | null;
  degraded: boolean;
  reason?: 'quota-exhausted' | 'no-grounding-available' | 'unavailable';
}

export async function selectModel(feature: FeatureId): Promise<ModelSelection> {
  const req = FEATURE_CHAINS[feature];
  if (!req) {
    return { modelId: null, degraded: true, reason: 'unavailable' };
  }

  const { chain, requiredQuotaKind, degradeInsteadOfFallback } = req;

  for (let i = 0; i < chain.length; i++) {
    const modelId = chain[i];
    if (hasModelQuota(modelId, requiredQuotaKind)) {
      return {
        modelId,
        degraded: i > 0,
      };
    }
  }

  // If no model in chain has quota
  if (degradeInsteadOfFallback) {
    return {
      modelId: null,
      degraded: true,
      reason: requiredQuotaKind === 'groundingSearch' ? 'no-grounding-available' : 'quota-exhausted',
    };
  }

  // Otherwise fallback to the last model in chain as best effort
  return {
    modelId: chain[chain.length - 1] || null,
    degraded: true,
    reason: 'quota-exhausted',
  };
}
