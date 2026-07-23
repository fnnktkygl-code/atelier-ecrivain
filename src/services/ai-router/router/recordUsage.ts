import { QuotaKind } from '../types/modelRegistry';
import { recordModelUsage } from '../quota/quotaStore';

export async function recordUsage(
  modelId: string,
  quotaKind: QuotaKind,
  outcome: 'success' | 'quota-error'
): Promise<void> {
  await recordModelUsage(modelId, quotaKind, outcome);
}
