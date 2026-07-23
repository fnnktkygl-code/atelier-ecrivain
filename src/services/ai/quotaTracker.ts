import { getDb } from '@/services/firebase/firestore';
import { doc, setDoc, onSnapshot, increment } from 'firebase/firestore';

const MAX_RPM = 15; // Requests per minute
const MAX_RPD = 1500; // Requests per day
const STORAGE_KEY = 'atelier_gemini_quota_v1';

interface QuotaData {
  minuteTimestamps: number[];
  dayCount: number;
  dayDate: string; // YYYY-MM-DD
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadQuota(): QuotaData {
  if (typeof window === 'undefined') {
    return { minuteTimestamps: [], dayCount: 0, dayDate: getTodayString() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaData;
      const today = getTodayString();
      if (parsed.dayDate !== today) {
        return { minuteTimestamps: [], dayCount: 0, dayDate: today };
      }
      return parsed;
    }
  } catch {}
  return { minuteTimestamps: [], dayCount: 0, dayDate: getTodayString() };
}

function saveQuota(data: QuotaData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('atelier_quota_updated'));
  } catch {}
}

/** Subscribe to shared Firestore multi-user quota updates */
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      const db = getDb();
      const quotaRef = doc(db, 'system', 'quotas');
      onSnapshot(quotaRef, (snap) => {
        if (snap.exists()) {
          const cloudData = snap.data();
          const today = getTodayString();
          if (cloudData.dayDate === today && typeof cloudData.dayCount === 'number') {
            const local = loadQuota();
            saveQuota({
              ...local,
              dayCount: Math.max(local.dayCount, cloudData.dayCount),
            });
          }
        }
      });
    } catch {}
  }, 2000);
}

/** Record a new API request */
export function recordApiRequest() {
  const data = loadQuota();
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Filter timestamps within last 60 seconds
  const activeMinute = data.minuteTimestamps.filter((t) => t > oneMinuteAgo);
  activeMinute.push(now);

  const updated: QuotaData = {
    minuteTimestamps: activeMinute,
    dayCount: data.dayCount + 1,
    dayDate: data.dayDate,
  };

  saveQuota(updated);

  // Sync to Firestore shared system counter asynchronously
  try {
    const db = getDb();
    const quotaRef = doc(db, 'system', 'quotas');
    setDoc(quotaRef, {
      dayCount: increment(1),
      dayDate: getTodayString(),
      lastUpdated: Date.now(),
    }, { merge: true }).catch(() => {});
  } catch {}
}

/** Get current quota status */
export function getQuotaStatus() {
  const data = loadQuota();
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const minuteCount = data.minuteTimestamps.filter((t) => t > oneMinuteAgo).length;

  const minuteRemaining = Math.max(0, MAX_RPM - minuteCount);
  const dayRemaining = Math.max(0, MAX_RPD - data.dayCount);

  return {
    minuteCount,
    minuteLimit: MAX_RPM,
    minuteRemaining,
    dayCount: data.dayCount,
    dayLimit: MAX_RPD,
    dayRemaining,
    isWarning: minuteRemaining <= 3 || dayRemaining <= 50,
  };
}
