'use client';

import { getAuth, signInWithPopup, signOut as firebaseSignOut, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseApp } from './config';

let authInstance: ReturnType<typeof getAuth> | null = null;

export function getAuthInstance() {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

const googleProvider = new GoogleAuthProvider();

export interface CachedUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const CACHED_USER_KEY = 'atelier_cached_auth_user';

export function getCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      const minimal: CachedUser = {
        uid: user.uid,
        displayName: user.displayName || null,
        email: user.email || null,
        photoURL: user.photoURL || null,
      };
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(minimal));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {}
}

export function clearCachedUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CACHED_USER_KEY);
  } catch {}
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getAuthInstance();
  const result = await signInWithPopup(auth, googleProvider);
  setCachedUser(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  const auth = getAuthInstance();
  clearCachedUser();
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, (u) => {
    setCachedUser(u);
    callback(u);
  });
}
