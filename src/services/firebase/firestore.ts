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
  type Firestore,
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

// ── Types ──
export interface ManuscriptMeta {
  id: string;
  title: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChapterData {
  title: string;
  paragraphs: string[];
  order: number;
}

// ── Manuscripts ──
export async function getManuscripts(uid: string): Promise<ManuscriptMeta[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'users', uid, 'manuscripts'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManuscriptMeta));
}

export async function createManuscript(uid: string, title: string): Promise<string> {
  const db = getDb();
  const ref = doc(collection(db, 'users', uid, 'manuscripts'));
  await setDoc(ref, {
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateManuscriptTitle(uid: string, manuscriptId: string, title: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  await setDoc(ref, { title, updatedAt: serverTimestamp() }, { merge: true });
}

// ── Chapters ──
export async function getChapters(uid: string, manuscriptId: string): Promise<ChapterData[]> {
  const db = getDb();
  const q = query(
    collection(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters'),
    orderBy('order')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ChapterData);
}

export async function saveChapter(uid: string, manuscriptId: string, chapterIdx: number, chapter: ChapterData): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', uid, 'manuscripts', manuscriptId, 'chapters', `ch-${chapterIdx}`);
  await setDoc(ref, chapter);
  // Update manuscript timestamp
  const mRef = doc(db, 'users', uid, 'manuscripts', manuscriptId);
  await setDoc(mRef, { updatedAt: serverTimestamp() }, { merge: true });
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
