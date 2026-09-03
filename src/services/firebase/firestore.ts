'use client';

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  onSnapshot,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseApp } from './config';
import { CHAPTERS } from '@/data/chapters';
import { NOTES } from '@/data/notes';

let dbInstance: Firestore | null = null;

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

// ── Recursive Firestore sanitizer: removes undefined values to prevent FirebaseError ──
export function sanitizeFirestoreObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestoreObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = sanitizeFirestoreObject(value);
      }
    }
    return result as T;
  }
  return obj;
}

// ── Types ──
export interface ManuscriptMeta {
  id: string;
  title: string;
  createdAt: unknown;
  updatedAt: unknown;
  wordCount?: number;
  chapterCount?: number;
  chaptersCount?: number;
}

export interface ChapterData {
  id?: string;
  title: string;
  paragraphs: string[];
  order: number;
  blocks?: Array<{ id?: string; content: string; type?: string; source?: string; createdAt?: number }>;
  notes?: Array<{ key?: string; content: string; id?: string; source?: string; category?: string }>;
  pendingReviews?: unknown[];
}

// ── Manuscripts ──
export async function getManuscripts(uid: string): Promise<ManuscriptMeta[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'users', uid, 'manuscripts'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManuscriptMeta));
}

export async function createManuscript(
  uid: string,
  title: string,
  initialChapters?: { title: string; paragraphs?: string[]; blocks?: { id?: string; content: string; type?: string; source?: string; createdAt?: number }[]; notes?: unknown[]; pendingReviews?: unknown[] }[]
): Promise<string> {
  const db = getDb();
  const mRef = doc(collection(db, 'users', uid, 'manuscripts'));
  const manuscriptId = mRef.id;
  const batch = writeBatch(db);

  const chaptersToSeed = (initialChapters && initialChapters.length > 0)
    ? initialChapters
    : [
        {
          title: 'Chapitre 1 — Nouveau chapitre',
          paragraphs: [''],
          blocks: [{ id: `b-${Date.now()}`, content: '', type: 'paragraph', source: 'manual', createdAt: Date.now() }],
          notes: [],
          pendingReviews: [],
        },
      ];

  batch.set(mRef, sanitizeFirestoreObject({
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    chapterCount: chaptersToSeed.length,
    wordCount: 0,
  }));

  chaptersToSeed.forEach((ch, idx) => {
    const chRef = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', `ch-${idx + 1}`);
    batch.set(chRef, sanitizeFirestoreObject({
      title: ch.title,
      paragraphs: ch.paragraphs || (ch.blocks ? ch.blocks.map((b) => b.content) : ['']),
      blocks: ch.blocks || [{ id: `b-${Date.now()}-${idx}`, content: '', type: 'paragraph', source: 'manual', createdAt: Date.now() }],
      notes: ch.notes || [],
      pendingReviews: ch.pendingReviews || [],
      order: idx,
      updatedAt: serverTimestamp(),
    }));
  });

  await batch.commit();
  return manuscriptId;
}

export async function updateManuscriptTitle(uid: string, manuscriptId: string, title: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  await setDoc(ref, sanitizeFirestoreObject({ title, updatedAt: serverTimestamp() }), { merge: true });
}

export async function deleteManuscript(uid: string, manuscriptId: string): Promise<void> {
  const db = getDb();
  
  // Clean chapters subcollection
  const chaptersCol = collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters');
  const snap = await getDocs(chaptersCol);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  
  // Delete manuscript doc
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  batch.delete(ref);
  await batch.commit();
}

// ── Chapters ──
export async function getChapters(uid: string, manuscriptId: string): Promise<ChapterData[]> {
  const db = getDb();
  const q = query(
    collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters'),
    orderBy('order')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterData) }));
}

/** Subscribe in real-time to chapter updates across devices */
export function subscribeToChapters(
  uid: string,
  manuscriptId: string,
  onUpdate: (chapters: ChapterData[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getDb();
  const q = query(
    collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters'),
    orderBy('order')
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterData) }));
      onUpdate(docs);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function toTimestampMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'object' && 'seconds' in val) {
    return (val as { seconds: number }).seconds * 1000;
  }
  if (typeof val === 'string') {
    const d = new Date(val).getTime();
    return isNaN(d) ? 0 : d;
  }
  return 0;
}

export async function getManuscriptMeta(uid: string, manuscriptId: string): Promise<ManuscriptMeta | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'users', uid, 'manuscripts', manuscriptId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ManuscriptMeta;
}

export async function saveChapter(uid: string, manuscriptId: string, chapterId: string, chapter: ChapterData): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', chapterId);
  await setDoc(ref, sanitizeFirestoreObject(chapter));
  // Update manuscript timestamp
  const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  await setDoc(mRef, sanitizeFirestoreObject({ updatedAt: serverTimestamp() }), { merge: true });
}

export async function saveAllChapters(
  uid: string,
  manuscriptId: string,
  chapters: { id?: string; title: string; blocks: { id?: string; content: string; type?: string; source?: string }[]; notes?: unknown[]; pendingReviews?: unknown[] }[]
): Promise<void> {
  const db = getDb();
  const chaptersCol = collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters');
  
  // 1. Fetch existing chapter docs in Firestore to clean up orphaned deleted chapters and perform diff check
  const existingSnap = await getDocs(chaptersCol);
  const existingDocsMap = new Map<string, DocumentData>();
  existingSnap.docs.forEach((docSnap) => {
    existingDocsMap.set(docSnap.id, docSnap.data());
  });
  
  const batch = writeBatch(db);
  const currentDocIds = new Set<string>();
  let hasWriteOps = false;

  chapters.forEach((ch, idx) => {
    const docId = ch.id || `ch-${idx + 1}`;
    currentDocIds.add(docId);
    const newParagraphs = ch.blocks.map((b) => b.content || '');
    const existing = existingDocsMap.get(docId);

    const isModified =
      !existing ||
      existing.title !== ch.title ||
      existing.order !== idx ||
      JSON.stringify(existing.paragraphs) !== JSON.stringify(newParagraphs) ||
      JSON.stringify(existing.blocks) !== JSON.stringify(ch.blocks) ||
      JSON.stringify(existing.notes) !== JSON.stringify(ch.notes || []) ||
      JSON.stringify(existing.pendingReviews) !== JSON.stringify(ch.pendingReviews || []);

    if (isModified) {
      const chRef = doc(chaptersCol, docId);
      batch.set(
        chRef,
        sanitizeFirestoreObject({
          title: ch.title,
          paragraphs: newParagraphs,
          blocks: ch.blocks,
          notes: ch.notes || [],
          pendingReviews: ch.pendingReviews || [],
          order: idx,
          updatedAt: serverTimestamp(),
        })
      );
      hasWriteOps = true;
    }
  });

  // 2. Delete orphaned docs
  existingSnap.docs.forEach((docSnap) => {
    if (!currentDocIds.has(docSnap.id)) {
      batch.delete(docSnap.ref);
      hasWriteOps = true;
    }
  });

  const totalWords = chapters.reduce(
    (sum, ch) =>
      sum +
      ch.blocks.reduce(
        (s, b) => s + (b.content ? b.content.split(/\s+/).filter(Boolean).length : 0),
        0
      ),
    0
  );

  const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  batch.set(
    mRef,
    sanitizeFirestoreObject({
      updatedAt: serverTimestamp(),
      wordCount: totalWords,
      chapterCount: chapters.length,
    }),
    { merge: true }
  );

  if (hasWriteOps) {
    await batch.commit();
  } else {
    // Only update manuscript metadata timestamp if no chapter contents were altered
    await setDoc(
      mRef,
      sanitizeFirestoreObject({
        updatedAt: serverTimestamp(),
        wordCount: totalWords,
        chapterCount: chapters.length,
      }),
      { merge: true }
    );
  }
}

// ── Notes ──
export async function getNotes(uid: string, manuscriptId: string): Promise<Record<string, string>> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'users', uid, 'manuscripts', manuscriptId, 'meta', 'notes'));
  if (!snap.exists()) return {};
  return snap.data() as Record<string, string>;
}

export async function saveNotes(uid: string, manuscriptId: string, notes: Record<string, string>): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'meta', 'notes');
  await setDoc(ref, notes);
}

// ── Migration: copy static data to Firestore on first login ──
export async function migrateStaticData(uid: string): Promise<string> {
  const db = getDb();

  // Check if user already has manuscripts
  const existing = await getManuscripts(uid);
  if (existing.length > 0) {
    return existing[0].id; // Already migrated
  }

  // Create the manuscript
  const mRef = doc(collection(db, 'users', uid, 'manuscripts'));
  const manuscriptId = mRef.id;

  const batch = writeBatch(db);

  // Manuscript meta
  batch.set(mRef, {
    title: "Mon Premier Manuscrit",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Chapters
  CHAPTERS.forEach((ch, idx) => {
    const chRef = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', `ch-${idx}`);
    batch.set(chRef, {
      title: ch.title,
      paragraphs: ch.paragraphs,
      order: idx,
    });
  });

  // Notes
  const notesRef = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'meta', 'notes');
  batch.set(notesRef, NOTES);

  // User profile with default pen name
  batch.set(doc(db, 'users', uid, 'profile', 'info'), {
    penName: '',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return manuscriptId;
}

// ── Pen Name ──
export async function getPenName(uid: string): Promise<string> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
  if (!snap.exists()) return '';
  return (snap.data()?.penName as string) || '';
}

export async function setPenName(uid: string, penName: string): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'users', uid, 'profile', 'info'), { penName }, { merge: true });
}

// ── Profile Settings (avatar color, email visibility) ──
export interface ProfileSettings {
  penName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  showEmail?: boolean;
}

export async function getProfileSettings(uid: string): Promise<ProfileSettings> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
  if (!snap.exists()) return {};
  return snap.data() as ProfileSettings;
}

export async function updateProfileSettings(uid: string, settings: Partial<ProfileSettings>): Promise<void> {
  const db = getDb();
  await setDoc(doc(db, 'users', uid, 'profile', 'info'), settings, { merge: true });
}

// ── Check if user has data ──
export async function hasUserData(uid: string): Promise<boolean> {
  const manuscripts = await getManuscripts(uid);
  return manuscripts.length > 0;
}
