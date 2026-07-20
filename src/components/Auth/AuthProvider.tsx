'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOut } from '@/services/firebase/auth';
import { migrateStaticData, getManuscripts, createManuscript, updateManuscriptTitle, getPenName, setPenName, getProfileSettings, updateProfileSettings as updateProfileSettingsDB, type ManuscriptMeta, type ProfileSettings } from '@/services/firebase/firestore';
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
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  selectManuscript: (m: ManuscriptMeta) => void;
  addManuscript: (title: string) => Promise<void>;
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
  signIn: async () => {},
  logOut: async () => {},
  selectManuscript: () => {},
  addManuscript: async () => {},
  refreshManuscripts: async () => {},
  updatePenName: async () => {},
  renameManuscript: async () => {},
  updateProfileSettings: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [manuscript, setManuscript] = useState<ManuscriptMeta | null>(null);
  const [manuscripts, setManuscripts] = useState<ManuscriptMeta[]>([]);
  const [penNameState, setPenNameState] = useState('');
  const [avatarColor, setAvatarColor] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showEmailState, setShowEmailState] = useState(true);

  const refreshManuscripts = useCallback(async () => {
    if (!user) return;
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        try {
          const mId = await migrateStaticData(u.uid);
          const list = await getManuscripts(u.uid);
          setManuscripts(list);
          const active = list.find((m) => m.id === mId) || list[0] || null;
          setManuscript(active);
          const name = await getPenName(u.uid);
          setPenNameState(name);
          const profileSettings = await getProfileSettings(u.uid);
          setAvatarColor(profileSettings.avatarColor || '');
          setAvatarUrl(profileSettings.avatarUrl || '');
          setShowEmailState(profileSettings.showEmail !== false);
        } catch (err) {
          console.error('Error loading user data:', err);
        }
      } else {
        setManuscript(null);
        setManuscripts([]);
        setPenNameState('');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        alert('La fenêtre de connexion a été fermée avant la fin.');
      } else if (err.code === 'auth/unauthorized-domain') {
        alert("Erreur: Ce domaine n'est pas autorisé dans la configuration Firebase (Authorized domains).");
      } else if (err.code === 'auth/web-storage-unsupported') {
        alert("Erreur: Les cookies tiers sont bloqués (fréquent en navigation privée). Veuillez les autoriser pour vous connecter.");
      } else {
        alert(`Erreur de connexion: ${err.message || 'Erreur inconnue'}`);
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
  };

  const addManuscript = async (title: string) => {
    if (!user) return;
    const id = await createManuscript(user.uid, title);
    const list = await getManuscripts(user.uid);
    setManuscripts(list);
    const newM = list.find((m) => m.id === id) || null;
    if (newM) setManuscript(newM);
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
    if (manuscript?.id === manuscriptId) {
      const updated = list.find((m) => m.id === manuscriptId) || null;
      if (updated) setManuscript(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, manuscript, manuscripts, penName: penNameState, avatarColor, avatarUrl, showEmail: showEmailState, signIn, logOut, selectManuscript, addManuscript, refreshManuscripts, updatePenName, renameManuscript, updateProfileSettings: updateProfileSettingsHandler }}>
      {children}
    </AuthContext.Provider>
  );
}
