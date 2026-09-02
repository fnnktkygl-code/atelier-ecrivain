'use client';

import { useAuth } from './AuthProvider';
import {
  IconMic,
  IconFeather,
  IconBook,
  IconShield,
  IconSparkles,
  IconAlertCircle,
  IconClose,
} from '@/components/Shared/Icons';

export default function LoginPage() {
  const { signIn, loading, authError, clearAuthError } = useAuth();

  const TRIPTYCH_STEPS = [
    {
      num: '01',
      title: 'Dictée Vocale Naturelle',
      model: 'Gemini 3.5 Transcribe',
      desc: 'Parlez sans retenue. L’IA transcrit votre oralité fidèlement sans interrompre votre inspiration créatrice.',
      Icon: IconMic,
    },
    {
      num: '02',
      title: 'Ratures & Variantes de Style',
      model: 'Gemini 3.7 Flash',
      desc: 'Vos hésitations et reprises (« non plutôt… ») sont isolées sous forme de ratures intelligentes comparables d’un clic.',
      Icon: IconFeather,
    },
    {
      num: '03',
      title: 'Liseuse & Export PDF Relié',
      model: 'Édition Typographique',
      desc: 'Relisez votre manuscrit dans une mise en page d’art, illustrez la couverture et exportez en PDF d’imprimerie.',
      Icon: IconBook,
    },
  ];

  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* ── 1. Hero Littéraire ── */}
        <header className="landing-hero">
          <div className="landing-badge">
            <IconSparkles size={14} className="landing-badge-icon" />
            <span>Studio Littéraire & Intelligence Artificielle</span>
          </div>

          <h1 className="landing-title">
            L&apos;art de l&apos;écriture,
            <br />
            <span className="landing-title-italic">libéré par la voix.</span>
          </h1>

          <p className="landing-subtitle">
            Dictez votre premier jet comme un brouillon vivant. L&apos;Atelier transcrit votre oral,
            détecte vos repentirs et structure votre manuscrit dans une élégance typographique absolue.
          </p>

          {/* ── CTA Google Auth ── */}
          <div className="landing-cta-box">
            {authError && (
              <div className="landing-error-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconAlertCircle size={16} strokeWidth={2} />
                  <span>{authError}</span>
                </div>
                <button onClick={clearAuthError} className="landing-error-close" aria-label="Fermer">
                  <IconClose size={14} strokeWidth={2.5} />
                </button>
              </div>
            )}

            <button
              className="btn-google-auth"
              onClick={signIn}
              disabled={loading}
              aria-label="Commencer à écrire avec Google"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="google-svg">
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
              <span>{loading ? 'Ouverture de votre sanctuaire…' : 'Entrer dans l’Atelier avec Google'}</span>
            </button>

            <div className="landing-guarantee">
              <IconShield size={13} />
              <span>Sanctuaire privé & chiffré · Vos manuscrits restent 100% votre propriété</span>
            </div>
          </div>
        </header>

        {/* ── 2. Le Triptyque de Création ── */}
        <section className="landing-triptych" aria-label="Comment fonctionne l'Atelier">
          <div className="landing-section-header">
            <span className="landing-section-eyebrow">Processus Créatif</span>
            <h2 className="landing-section-title">Du premier souffle oral au livre achevé</h2>
          </div>

          <div className="landing-steps-grid">
            {TRIPTYCH_STEPS.map((step) => {
              const { Icon } = step;
              return (
                <div key={step.num} className="landing-step-card">
                  <div className="landing-step-top">
                    <div className="landing-step-icon">
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <span className="landing-step-num">{step.num}</span>
                  </div>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <span className="landing-step-tag">{step.model}</span>
                  <p className="landing-step-desc">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
