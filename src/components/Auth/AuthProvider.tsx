'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOut, getCachedUser, clearCachedUser } from '@/services/firebase/auth';
import { migrateStaticData, getManuscripts, createManuscript as createManuscriptDB, updateManuscriptTitle, deleteManuscript as deleteManuscriptDB, getPenName, setPenName, getProfileSettings, updateProfileSettings as updateProfileSettingsDB, type ManuscriptMeta, type ProfileSettings } from '@/services/firebase/firestore';
import { isFirebaseConfigured } from '@/services/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  manuscript: ManuscriptMeta | null;
  manuscripts: ManuscriptMeta[];
  penName: string;
  avatarColor: string;
  avatarUrl: string;
  showEmail: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  selectManuscript: (m: ManuscriptMeta) => void;
  addManuscript: (title: string) => Promise<void>;
  createManuscript: (title: string) => Promise<void>;
  deleteManuscript: (manuscriptId: string) => Promise<void>;
  refreshManuscripts: () => Promise<void>;
  updatePenName: (name: string) => Promise<void>;
  renameManuscript: (manuscriptId: string, title: string) => Promise<void>;
  updateProfileSettings: (settings: Partial<ProfileSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  manuscript: null,
  manuscripts: [],
  penName: '',
  avatarColor: '',
  avatarUrl: '',
  showEmail: true,
  authError: null,
  clearAuthError: () => {},
  signIn: async () => {},
  logOut: async () => {},
  selectManuscript: () => {},
  addManuscript: async () => {},
  createManuscript: async () => {},
  deleteManuscript: async () => {},
  refreshManuscripts: async () => {},
  updatePenName: async () => {},
  renameManuscript: async () => {},
  updateProfileSettings: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function resolveActiveManuscript(list: ManuscriptMeta[], preferredId?: string | null): ManuscriptMeta | null {
  if (!list || list.length === 0) return null;

  if (preferredId) {
    const candidate = list.find((m) => m.id === preferredId);
    if (candidate && candidate.title && candidate.title.trim() !== '' && candidate.title !== 'Sans titre') {
      return candidate;
    }
  }

  // 1. Look for custom named user book (e.g. "Mon amour avec un...")
  const customNamed = list.find(
    (m) =>
      m.title &&
      m.title.trim() !== '' &&
      m.title !== 'Sans titre' &&
      m.title !== 'Mon Premier Manuscrit' &&
      m.title !== 'Dieu à l’image des hommes'
  );
  if (customNamed) return customNamed;

  // 2. Look for any named book
  const anyNamed = list.find((m) => m.title && m.title.trim() !== '' && m.title !== 'Sans titre');
  if (anyNamed) return anyNamed;

  // 3. Fallback to preferred candidate if nothing better exists
  if (preferredId) {
    const candidate = list.find((m) => m.id === preferredId);
    if (candidate) return candidate;
  }

  return list[0] || null;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return { uid: 'mock-writer', displayName: 'Richard', email: 'richard@ecrivain.fr' } as unknown as User;
    }
    return getCachedUser();
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return false;
    }
    // If cached user exists, don't block render in loading state
    if (getCachedUser()) {
      return false;
    }
    return isFirebaseConfigured();
  });

  const [manuscripts, setManuscripts] = useState<ManuscriptMeta[]>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return [{
        id: 'ms-1',
        title: 'Dieu à l’image des hommes',
        author: 'Richard',
        wordCount: 1363,
        chaptersCount: 4,
        lastModified: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        coverUrl: '',
      }];
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('atelier_cached_manuscripts');
        if (raw) return JSON.parse(raw) as ManuscriptMeta[];
      } catch {}
    }
    return [];
  });

  const [manuscript, setManuscript] = useState<ManuscriptMeta | null>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return {
        id: 'ms-1',
        title: 'Dieu à l’image des hommes',
        author: 'Richard',
        wordCount: 1363,
        chaptersCount: 4,
        lastModified: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        coverUrl: '',
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const rawMsList = localStorage.getItem('atelier_cached_manuscripts');
        const activeId = localStorage.getItem('atelier_last_active_manuscript_id');
        if (rawMsList) {
          const list = JSON.parse(rawMsList) as ManuscriptMeta[];
          return resolveActiveManuscript(list, activeId);
        }
      } catch {}
    }
    return null;
  });

  const [penNameState, setPenNameState] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return 'Richard';
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('atelier_cached_pen_name') || '';
    }
    return '';
  });

  const [avatarColor, setAvatarColor] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showEmailState, setShowEmailState] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const refreshManuscripts = useCallback(async () => {
    if (!user) return;
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('atelier_cached_manuscripts', JSON.stringify(list));
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock=true')) {
      return;
    }

    if (!isFirebaseConfigured()) {
      return;
    }

    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        try {
          const mId = await migrateStaticData(u.uid);
          const list = await getManuscripts(u.uid);
          setManuscripts(list);
          if (typeof window !== 'undefined') {
            localStorage.setItem('atelier_cached_manuscripts', JSON.stringify(list));
          }

          const profileSettings = await getProfileSettings(u.uid);
          const storedMsId = typeof window !== 'undefined' ? localStorage.getItem('atelier_last_active_manuscript_id') : null;
          const targetId = storedMsId || profileSettings.lastActiveManuscriptId || mId;

          const active = resolveActiveManuscript(list, targetId);
          setManuscript(active);

          if (active && typeof window !== 'undefined') {
            localStorage.setItem('atelier_last_active_manuscript_id', active.id);
          }

          const name = await getPenName(u.uid);
          setPenNameState(name);
          if (typeof window !== 'undefined' && name) {
            localStorage.setItem('atelier_cached_pen_name', name);
          }

          setAvatarColor(profileSettings.avatarColor || '');
          setAvatarUrl(profileSettings.avatarUrl || '');
          setShowEmailState(profileSettings.showEmail !== false);
        } catch (err) {
          console.error('Error loading user data:', err);
        }
      } else {
        clearCachedUser();
        setManuscript(null);
        setManuscripts([]);
        setPenNameState('');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('atelier_cached_manuscripts');
          localStorage.removeItem('atelier_cached_pen_name');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      const authErr = err as { code?: string; message?: string };
      if (authErr.code === 'auth/popup-closed-by-user') {
        setAuthError('La fenêtre de connexion a été fermée avant la fin.');
      } else if (authErr.code === 'auth/unauthorized-domain') {
        setAuthError("Ce domaine n'est pas autorisé dans la configuration Firebase (Authorized domains).");
      } else if (authErr.code === 'auth/web-storage-unsupported') {
        setAuthError("Les cookies tiers sont bloqués (fréquent en navigation privée). Veuillez les autoriser pour vous connecter.");
      } else {
        setAuthError(`Erreur de connexion: ${authErr.message || 'Erreur inconnue'}`);
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut();
      setManuscript(null);
      setManuscripts([]);
      setPenNameState('');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const selectManuscript = (m: ManuscriptMeta) => {
    setManuscript(m);
    if (typeof window !== 'undefined') {
      localStorage.setItem('atelier_last_active_manuscript_id', m.id);
    }
    if (user) {
      updateProfileSettingsDB(user.uid, { lastActiveManuscriptId: m.id }).catch(() => {});
    }
  };

  const addManuscript = async (title: string) => {
    if (!user) return;
    const id = await createManuscriptDB(user.uid, title);
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('atelier_cached_manuscripts', JSON.stringify(list));
    }
    const newM = list.find((m) => m.id === id) || null;
    if (newM) {
      setManuscript(newM);
      if (typeof window !== 'undefined') {
        localStorage.setItem('atelier_last_active_manuscript_id', newM.id);
      }
      updateProfileSettingsDB(user.uid, { lastActiveManuscriptId: newM.id }).catch(() => {});
    }
  };

  const deleteManuscriptHandler = async (manuscriptId: string) => {
    if (!user) return;
    await deleteManuscriptDB(user.uid, manuscriptId);
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('atelier_cached_manuscripts', JSON.stringify(list));
    }
    if (manuscript?.id === manuscriptId) {
      const nextActive = resolveActiveManuscript(list);
      setManuscript(nextActive);
      if (nextActive && typeof window !== 'undefined') {
        localStorage.setItem('atelier_last_active_manuscript_id', nextActive.id);
      }
      if (nextActive) {
        updateProfileSettingsDB(user.uid, { lastActiveManuscriptId: nextActive.id }).catch(() => {});
      }
    }
  };

  const updatePenName = async (name: string) => {
    if (!user) return;
    await setPenName(user.uid, name);
    setPenNameState(name);
  };

  const updateProfileSettingsHandler = async (settings: Partial<ProfileSettings>) => {
    if (!user) return;
    await updateProfileSettingsDB(user.uid, settings);
    if (settings.avatarColor !== undefined) setAvatarColor(settings.avatarColor);
    if (settings.avatarUrl !== undefined) setAvatarUrl(settings.avatarUrl);
    if (settings.showEmail !== undefined) setShowEmailState(settings.showEmail);
    if (settings.penName !== undefined) setPenNameState(settings.penName);
  };

  const renameManuscript = async (manuscriptId: string, title: string) => {
    if (!user) return;
    await updateManuscriptTitle(user.uid, manuscriptId, title);
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('atelier_cached_manuscripts', JSON.stringify(list));
    }
    if (manuscript?.id === manuscriptId) {
      const updated = list.find((m) => m.id === manuscriptId) || null;
      if (updated) setManuscript(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, manuscript, manuscripts, penName: penNameState, avatarColor, avatarUrl, showEmail: showEmailState, authError, clearAuthError, signIn, logOut, selectManuscript, addManuscript, createManuscript: addManuscript, deleteManuscript: deleteManuscriptHandler, refreshManuscripts, updatePenName, renameManuscript, updateProfileSettings: updateProfileSettingsHandler }}>
      {children}
    </AuthContext.Provider>
  );
}
