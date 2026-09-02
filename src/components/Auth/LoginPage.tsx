'use client';

import { useAuth } from './AuthProvider';
import {
  IconMic,
  IconScissors,
  IconBook,
  IconShield,
  IconAlertCircle,
  IconClose,
} from '@/components/Shared/Icons';

export default function LoginPage() {
  const { signIn, loading, authError, clearAuthError } = useAuth();

  const features = [
    {
      Icon: IconMic,
      title: 'Dictée vocale Gemini',
      desc: "Parlez librement, comme un brouillon oral. L'IA transcrit, identifie vos hésitations, ratures et reformulations — exactement comme un vrai premier jet sur papier.",
    },
    {
      Icon: IconScissors,
      title: 'Ratures & corrections de style',
      desc: "Gemini 3.7 détecte vos auto-corrections en temps réel. Quand vous dites « non, plutôt… », l'IA comprend et vous propose les deux versions à comparer.",
    },
    {
      Icon: IconBook,
      title: 'Liseuse & Export PDF',
      desc: 'Relisez votre manuscrit comme un vrai livre, avec typographie éditoriale, surlignage et génération de couvertures par IA.',
    },
    {
      Icon: IconShield,
      title: 'Espace privé & RGPD',
      desc: 'Chaque auteur dispose d’un espace sécurisé et chiffré. Vos manuscrits ne sont accessibles que par vous, avec export et suppression intégrale des données.',
    },
  ];

  return (
    <div className="home-dash">
      {/* ── Hero ── */}
      <div className="home-welcome">
        <span className="home-welcome-eyebrow">Atelier d&apos;Écriture Numérique</span>
        <h1 className="home-greeting">
          Écrivez comme sur papier,
          <br />
          avec la puissance de l&apos;IA
        </h1>
        <p className="home-sub">
          Dictez votre manuscrit à voix haute, comme un premier brouillon.
          L&apos;intelligence artificielle transcrit, détecte vos ratures,
          reformulations et hésitations — pour recréer le processus naturel
          d&apos;écriture.
        </p>
      </div>

      {/* ── CTA ── */}
      <div style={{ textAlign: 'center', marginBottom: 40, width: '100%', maxWidth: 420 }}>
        {authError && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--japandi-terracotta-subtle)',
              border: '1px solid var(--japandi-terracotta)',
              color: 'var(--japandi-terracotta)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconAlertCircle size={16} strokeWidth={2} />
              <span>{authError}</span>
            </div>
            <button
              onClick={clearAuthError}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--japandi-terracotta)',
                cursor: 'pointer',
                padding: 2,
              }}
              aria-label="Fermer le message d'erreur"
            >
              <IconClose size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={signIn}
          disabled={loading}
          style={{
            width: '100%',
            height: 48,
            fontSize: 15,
            borderRadius: 'var(--radius-full)',
            gap: 12,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Connexion en cours…' : 'Continuer avec Google'}</span>
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          Connexion sécurisée sans mot de passe · Vos données vous appartiennent
        </p>
      </div>

      {/* ── Features Grid ── */}
      <section className="home-actions" style={{ maxWidth: 780, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {features.map((feat) => {
          const { Icon } = feat;
          return (
            <div key={feat.title} className="home-action" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
              <div className="home-action-icon-wrap">
                <Icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="home-action-title" style={{ fontSize: 16 }}>{feat.title}</h3>
              <p className="home-action-desc">{feat.desc}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
