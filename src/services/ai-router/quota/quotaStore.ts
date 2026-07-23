import { getDb } from '@/services/firebase/firestore';
import { doc, setDoc, onSnapshot, increment } from 'firebase/firestore';
import { QuotaKind, MODEL_REGISTRY } from '../types/modelRegistry';
import { getPacificDateString } from './resetSchedule';

interface QuotaState {
  minuteCount: number;
  dayCount: number;
  dayDate: string;
  cooldownUntilPacificDate?: string;
}

const STORAGE_PREFIX = 'atelier_quota_router_v2_';

function getStorageKey(modelId: string, quotaKind: QuotaKind): string {
  return `${STORAGE_PREFIX}${modelId}_${quotaKind}`;
}

export function loadModelQuota(modelId: string, quotaKind: QuotaKind): QuotaState {
  const today = getPacificDateString();
  if (typeof window === 'undefined') {
    return { minuteCount: 0, dayCount: 0, dayDate: today };
  }
  try {
    const raw = localStorage.getItem(getStorageKey(modelId, quotaKind));
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaState;
      if (parsed.dayDate !== today) {
        return { minuteCount: 0, dayCount: 0, dayDate: today };
      }
      return parsed;
    }
  } catch {}
  return { minuteCount: 0, dayCount: 0, dayDate: today };
}

export function saveModelQuota(modelId: string, quotaKind: QuotaKind, state: QuotaState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(modelId, quotaKind), JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('atelier_quota_updated'));
  } catch {}
}

/** Check if model has quota available for given quotaKind */
export function hasModelQuota(modelId: string, quotaKind: QuotaKind): boolean {
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!model || model.knownUnavailable) return false;

  const limits = model.quotas[quotaKind];
  if (!limits) return false;

  const state = loadModelQuota(modelId, quotaKind);
  const today = getPacificDateString();

  // If in cooldown for today after 429
  if (state.cooldownUntilPacificDate === today) {
    return false;
  }

  // Check RPD limit
  if (limits.rpd !== null && state.dayCount >= limits.rpd) {
    return false;
  }

  // Check RPM limit
  if (limits.rpm !== null && state.minuteCount >= limits.rpm) {
    return false;
  }

  return true;
}

/** Increment local & Firestore usage counters or register cooldown */
export async function recordModelUsage(
  modelId: string,
  quotaKind: QuotaKind,
  outcome: 'success' | 'quota-error'
): Promise<void> {
  const today = getPacificDateString();
  const state = loadModelQuota(modelId, quotaKind);

  if (outcome === 'quota-error') {
    state.cooldownUntilPacificDate = today;
    saveModelQuota(modelId, quotaKind, state);
    return;
  }

  state.dayCount += 1;
  state.minuteCount += 1;
  saveModelQuota(modelId, quotaKind, state);

  // Sync to shared Firestore counter asynchronously
  if (typeof window !== 'undefined') {
    try {
      const db = getDb();
      const docRef = doc(db, 'system', 'quotas', 'models', `${modelId}_${quotaKind}`);
      await setDoc(
        docRef,
        {
          modelId,
          quotaKind,
          dayDate: today,
          dayCount: increment(1),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch {}
  }

  // Reset minute count after 60 seconds
  setTimeout(() => {
    const curState = loadModelQuota(modelId, quotaKind);
    if (curState.minuteCount > 0) {
      curState.minuteCount -= 1;
      saveModelQuota(modelId, quotaKind, curState);
    }
  }, 60000);
}
