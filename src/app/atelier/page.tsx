'use client';

import { useAuth } from '@/components/Auth/AuthProvider';
import LoginPage from '@/components/Auth/LoginPage';
import AtelierPage from '@/components/Atelier/AtelierPage';

export default function Atelier() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-soft)', fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', letterSpacing: '.08em' }}>
        Chargement...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AtelierPage />;
}
