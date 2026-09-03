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
  const list = snap.docs.map((d) => {
    const data = d.data();
    const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
    return {
      id: d.id,
      ...data,
      title: rawTitle || 'Sans titre',
    } as ManuscriptMeta;
  });

  // Sort by most recently modified / created first
  list.sort((a, b) => {
    const timeA = toTimestampMillis(a.updatedAt) || toTimestampMillis(a.createdAt) || 0;
    const timeB = toTimestampMillis(b.updatedAt) || toTimestampMillis(b.createdAt) || 0;
    return timeB - timeA;
  });

  return list;
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
          blocks: [{ id: `b-${Date.now()}-0`, content: '', type: 'paragraph', source: 'manual', createdAt: Date.now() }],
          notes: [],
          pendingReviews: [],
        },
      ];

  batch.set(mRef, sanitizeFirestoreObject({
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    chapterCount: chaptersToSeed.length,
    chaptersCount: chaptersToSeed.length,
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

export interface DeduplicatableChapter {
  id?: string;
  title: string;
  order?: number;
  blocks?: Array<{ id?: string; content?: string; type?: string; source?: string; createdAt?: number }>;
  paragraphs?: string[];
  notes?: unknown[];
  pendingReviews?: unknown[];
}

/**
 * Normalizes title for comparing chapter identities:
 * Strips accents, punctuation, hyphens, and multiple whitespaces.
 */
export function normalizeTitleForComparison(title?: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/—|-|–/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps chapter ID aliases to a canonical key.
 * Example: 'ch-static-1' -> 'ch-1'
 */
export function getCanonicalChapterKey(id?: string): string {
  if (!id) return '';
  return id.replace('ch-static-', 'ch-');
}

/**
 * Extracts a normalized snippet of the chapter's first non-empty text content
 * for content-based duplicate detection.
 */
export function getFirstParagraphSnippet(ch: DeduplicatableChapter): string {
  if (ch.blocks && ch.blocks.length > 0) {
    const first = ch.blocks.find((b) => b && b.content && b.content.trim().length > 0);
    if (first && first.content) {
      return first.content.substring(0, 100).trim().toLowerCase().replace(/\s+/g, ' ');
    }
  }
  if (ch.paragraphs && ch.paragraphs.length > 0) {
    const first = ch.paragraphs.find((p) => p && p.trim().length > 0);
    if (first) {
      return first.substring(0, 100).trim().toLowerCase().replace(/\s+/g, ' ');
    }
  }
  return '';
}

/**
 * Returns total non-whitespace characters in chapter content.
 */
export function getChapterContentLength(ch: DeduplicatableChapter): number {
  if (ch.blocks && ch.blocks.length > 0) {
    return ch.blocks.reduce((sum, b) => sum + (b.content?.trim().length || 0), 0);
  }
  if (ch.paragraphs && ch.paragraphs.length > 0) {
    return ch.paragraphs.reduce((sum, p) => sum + (p?.trim().length || 0), 0);
  }
  return 0;
}

/**
 * Given two chapters representing the same chapter, picks the primary/keeper
 * and marks the redundant one for removal.
 */
function selectPrimaryChapter<T extends DeduplicatableChapter>(
  a: T,
  b: T
): { keeper: T; duplicate: T } {
  const lenA = getChapterContentLength(a);
  const lenB = getChapterContentLength(b);

  // 1. Keep the chapter with strictly more content
  if (lenA > lenB) return { keeper: a, duplicate: b };
  if (lenB > lenA) return { keeper: b, duplicate: a };

  // 2. If content is equal, prefer standard 'ch-X' ID over 'ch-static-X'
  const isAStandard = a.id && /^ch-\d+$/.test(a.id);
  const isBStandard = b.id && /^ch-\d+$/.test(b.id);
  if (isAStandard && !isBStandard) return { keeper: a, duplicate: b };
  if (isBStandard && !isAStandard) return { keeper: b, duplicate: a };

  // 3. Prefer chapter that has structured blocks over raw paragraphs
  const hasBlocksA = a.blocks && a.blocks.length > 0;
  const hasBlocksB = b.blocks && b.blocks.length > 0;
  if (hasBlocksA && !hasBlocksB) return { keeper: a, duplicate: b };
  if (hasBlocksB && !hasBlocksA) return { keeper: b, duplicate: a };

  // 4. Default: keep 'a'
  return { keeper: a, duplicate: b };
}

/**
 * Robust chapter deduplication across multi-device synchronizations:
 * Eliminates duplicate documents caused by ID mismatches (e.g. ch-1 vs ch-static-1),
 * duplicate seeds, or concurrent saves.
 */
export function deduplicateChapterList<T extends DeduplicatableChapter>(
  list: T[]
): { deduplicated: T[]; duplicateIds: string[] } {
  const deduplicated: T[] = [];
  const duplicateIds: string[] = [];

  for (const candidate of list) {
    const normTitle = normalizeTitleForComparison(candidate.title);
    const canonId = getCanonicalChapterKey(candidate.id);
    const snippet = getFirstParagraphSnippet(candidate);

    const existingIndex = deduplicated.findIndex((kept) => {
      // 1. Canonical ID match (e.g. ch-1 vs ch-static-1)
      if (canonId && canonId === getCanonicalChapterKey(kept.id)) {
        return true;
      }
      // 2. Normalized title match (if not empty)
      if (normTitle && normTitle === normalizeTitleForComparison(kept.title)) {
        return true;
      }
      // 3. Content snippet match (if meaningful content exists)
      if (snippet && snippet.length >= 20 && snippet === getFirstParagraphSnippet(kept)) {
        return true;
      }
      return false;
    });

    if (existingIndex === -1) {
      deduplicated.push({ ...candidate });
    } else {
      const kept = deduplicated[existingIndex];
      const { keeper, duplicate } = selectPrimaryChapter(kept, candidate);
      deduplicated[existingIndex] = keeper;
      if (duplicate.id) {
        duplicateIds.push(duplicate.id);
      }
    }
  }

  // Re-index contiguous order 0, 1, 2...
  deduplicated.forEach((ch, idx) => {
    ch.order = idx;
  });

  return { deduplicated, duplicateIds };
}

export async function getChapters(uid: string, manuscriptId: string): Promise<ChapterData[]> {
  const db = getDb();
  const colRef = collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters');
  const snap = await getDocs(colRef);
  const rawDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterData) }));

  // In-memory robust sort to prevent Firestore index omissions
  rawDocs.sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 9999;
    const orderB = typeof b.order === 'number' ? b.order : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || '').localeCompare(b.id || '');
  });

  const { deduplicated, duplicateIds } = deduplicateChapterList(rawDocs);

  // Self-heal Firestore by asynchronously deleting duplicate docs
  if (duplicateIds.length > 0) {
    const batch = writeBatch(db);
    duplicateIds.forEach((dupId) => {
      batch.delete(doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', dupId));
    });
    const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
    batch.set(
      mRef,
      sanitizeFirestoreObject({
        chapterCount: deduplicated.length,
        chaptersCount: deduplicated.length,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
    batch.commit().catch((e) => console.warn('[getChapters] Error cleaning duplicate chapters in Firestore:', e));
  }

  return deduplicated;
}

/** Subscribe in real-time to chapter updates across devices */
export function subscribeToChapters(
  uid: string,
  manuscriptId: string,
  onUpdate: (chapters: ChapterData[]) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getDb();
  const colRef = collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters');
  return onSnapshot(
    colRef,
    (snap) => {
      const rawDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChapterData) }));
      rawDocs.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 9999;
        const orderB = typeof b.order === 'number' ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.id || '').localeCompare(b.id || '');
      });

      const { deduplicated, duplicateIds } = deduplicateChapterList(rawDocs);

      if (duplicateIds.length > 0) {
        const batch = writeBatch(db);
        duplicateIds.forEach((dupId) => {
          batch.delete(doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', dupId));
        });
        const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
        batch.set(
          mRef,
          sanitizeFirestoreObject({
            chapterCount: deduplicated.length,
            chaptersCount: deduplicated.length,
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        );
        batch.commit().catch((e) => console.warn('[subscribeToChapters] Error cleaning duplicate chapters in Firestore:', e));
      }

      onUpdate(deduplicated);
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
  if (!chapters || chapters.length === 0) {
    return;
  }

  const db = getDb();
  const chaptersCol = collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters');
  
  // 1. Fetch existing chapter docs in Firestore to clean up orphaned deleted chapters and perform diff check
  const existingSnap = await getDocs(chaptersCol);
  const existingDocsMap = new Map<string, DocumentData>();
  existingSnap.docs.forEach((docSnap) => {
    existingDocsMap.set(docSnap.id, docSnap.data());
  });

  // Anti-wipe safety guard: prevent a single empty placeholder from wiping populated cloud chapters
  const isSingleEmptyPlaceholder =
    chapters.length === 1 &&
    chapters[0].blocks.every((b) => !b.content || !b.content.trim()) &&
    (chapters[0].title.includes('Nouveau chapitre') || chapters[0].title === 'Chapitre 1');

  const existingHasRealContent =
    existingSnap.docs.length > 1 ||
    (existingSnap.docs.length === 1 &&
      ((existingSnap.docs[0].data().paragraphs || []).some((p: string) => p && p.trim().length > 0) ||
       (existingSnap.docs[0].data().blocks || []).some((b: { content?: string }) => b?.content && b.content.trim().length > 0)));

  if (isSingleEmptyPlaceholder && existingHasRealContent) {
    console.warn('[saveAllChapters] Anti-wipe triggered: Blocked overwriting populated cloud chapters with empty placeholder.');
    return;
  }

  // Deduplicate input chapters to guarantee no duplicates are written to Firestore
  const { deduplicated: cleanChapters } = deduplicateChapterList(chapters);
  
  const batch = writeBatch(db);
  const currentDocIds = new Set<string>();
  let hasWriteOps = false;

  cleanChapters.forEach((ch, idx) => {
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

  // 2. Delete orphaned docs only if we have active valid chapters and not an empty placeholder
  if (cleanChapters.length > 0 && !isSingleEmptyPlaceholder) {
    existingSnap.docs.forEach((docSnap) => {
      if (!currentDocIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        hasWriteOps = true;
      }
    });
  }

  const totalWords = cleanChapters.reduce(
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
      chapterCount: cleanChapters.length,
      chaptersCount: cleanChapters.length,
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
        chaptersCount: chapters.length,
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

// ── Seed / Self-heal default foundational chapters ──
export async function seedDefaultChapters(uid: string, manuscriptId: string, title: string = "Dieu à l’image des hommes"): Promise<void> {
  const db = getDb();
  const batch = writeBatch(db);

  CHAPTERS.forEach((ch, idx) => {
    const chRef = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', `ch-${idx + 1}`);
    const blocks = ch.paragraphs.map((p, pIdx) => ({
      id: `b-mig-${idx + 1}-${pIdx}`,
      content: p,
      type: 'paragraph',
      source: 'original',
      createdAt: Date.now(),
    }));

    batch.set(chRef, sanitizeFirestoreObject({
      title: ch.title,
      paragraphs: ch.paragraphs,
      blocks,
      notes: [],
      pendingReviews: [],
      order: idx,
      updatedAt: serverTimestamp(),
    }));
  });

  const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  batch.set(mRef, sanitizeFirestoreObject({
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    chapterCount: CHAPTERS.length,
    chaptersCount: CHAPTERS.length,
    wordCount: 1363,
  }), { merge: true });

  const notesRef = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'meta', 'notes');
  batch.set(notesRef, NOTES);

  await batch.commit();
}

// ── Migration: copy static data to Firestore on first login or self-heal empty state ──
export async function migrateStaticData(uid: string): Promise<string> {
  const db = getDb();

  // Check if user already has manuscripts
  const existing = await getManuscripts(uid);
  if (existing.length > 0) {
    // 1. Prioritize custom user-named manuscript with chapters
    const customNamedWithChapters = existing.find(
      (m) =>
        m.title &&
        m.title !== 'Sans titre' &&
        m.title !== 'Mon Premier Manuscrit' &&
        m.title !== 'Dieu à l’image des hommes' &&
        (m.chapterCount ?? m.chaptersCount ?? 0) > 0
    );
    if (customNamedWithChapters) {
      return customNamedWithChapters.id;
    }

    // 2. Prioritize any custom named manuscript
    const customNamed = existing.find(
      (m) =>
        m.title &&
        m.title !== 'Sans titre' &&
        m.title !== 'Mon Premier Manuscrit' &&
        m.title !== 'Dieu à l’image des hommes'
    );
    if (customNamed) {
      return customNamed.id;
    }

    // 3. Check if any existing manuscript has chapters
    for (const m of existing) {
      const chs = await getChapters(uid, m.id);
      if (chs.length > 0) {
        return m.id;
      }
    }

    // All existing manuscripts are empty -> return the primary one without creating a duplicate
    return existing[0].id;
  }

  // Create the initial manuscript ONLY if user has 0 manuscripts
  const mRef = doc(collection(db, 'users', uid, 'manuscripts'));
  const manuscriptId = mRef.id;
  await seedDefaultChapters(uid, manuscriptId);

  // User profile with default pen name and active manuscript
  await setDoc(doc(db, 'users', uid, 'profile', 'info'), sanitizeFirestoreObject({
    penName: '',
    lastActiveManuscriptId: manuscriptId,
    createdAt: serverTimestamp(),
  }), { merge: true });

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

// ── Profile Settings (avatar color, email visibility, last active manuscript) ──
export interface ProfileSettings {
  penName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  showEmail?: boolean;
  lastActiveManuscriptId?: string;
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
