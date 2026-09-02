'use client';

import Link from 'next/link';
import { useAuth } from '@/components/Auth/AuthProvider';
import LoginPage from '@/components/Auth/LoginPage';
import { IconMic, IconFeather, IconBook, IconLightbulb, IconChevronRight } from '@/components/Shared/Icons';

export default function Dashboard() {
  const { user, loading, manuscript, penName } = useAuth();

  if (loading) {
    return (
      <div className="dash-loading-state">
        <span className="loading-spinner" />
        <span>Préparation de votre atelier…</span>
      </div>
    );
  }

  // Not logged in → show landing page
  if (!user) {
    return <LoginPage />;
  }

  const displayName = penName || user.displayName?.split(' ')[0] || 'Écrivain';

  return (
    <div className="home-dash">
      <div className="home-dash-inner">
        <header className="home-welcome">
          <span className="home-welcome-eyebrow">Atelier d&apos;écriture & Studio littéraire</span>
          <h1 className="home-greeting">Bienvenue, {displayName}</h1>
          <p className="home-sub">
            Votre espace de création est prêt. Que souhaitez-vous accomplir aujourd&apos;hui ?
          </p>
          {manuscript && (
            <Link
              href="/atelier"
              className="home-manuscript-badge"
              title="Accéder directement au manuscrit actif dans l'atelier"
            >
              <IconBook size={14} strokeWidth={2} />
              <span className="manuscript-badge-label">Manuscrit actif :</span>
              <span className="manuscript-badge-title">{manuscript.title}</span>
              <IconChevronRight size={13} strokeWidth={2} className="manuscript-badge-arrow" />
            </Link>
          )}
        </header>

        <section className="home-actions" aria-label="Actions principales">
          <Link href="/atelier" className="home-action">
            <div className="home-action-icon-wrap">
              <IconMic size={22} strokeWidth={1.9} />
            </div>
            <h2 className="home-action-title">Dicter</h2>
            <p className="home-action-desc desktop-only">
              Enregistrez à voix haute. L&apos;IA Gemini structure votre oral en premier jet fidèle.
            </p>
            <p className="home-action-desc mobile-only">
              Dictée vocale & structuration IA
            </p>
          </Link>

          <Link href="/atelier" className="home-action">
            <div className="home-action-icon-wrap">
              <IconFeather size={22} strokeWidth={1.9} />
            </div>
            <h2 className="home-action-title">Éditer</h2>
            <p className="home-action-desc desktop-only">
              Façonnez votre manuscrit. Suggestions de style, ratures et annotations de marge.
            </p>
            <p className="home-action-desc mobile-only">
              Chapitres, style & notes
            </p>
          </Link>

          <Link href="/liseuse" className="home-action">
            <div className="home-action-icon-wrap">
              <IconBook size={22} strokeWidth={1.9} />
            </div>
            <h2 className="home-action-title">Lire</h2>
            <p className="home-action-desc desktop-only">
              Relisez votre texte dans une mise en page d&apos;édition soignée, sans distraction.
            </p>
            <p className="home-action-desc mobile-only">
              Liseuse sans distraction
            </p>
          </Link>
        </section>

        <aside className="home-tip" aria-label="Conseil d'écriture">
          <div className="home-tip-icon">
            <IconLightbulb size={16} strokeWidth={2} />
          </div>
          <div className="home-tip-body">
            <span className="home-tip-title">Conseil de l&apos;Atelier :</span>{' '}
            <span className="home-tip-text">
              <strong>La dictée préserve votre élan naturel.</strong> Vos reprises (« en fait… ») sont isolées automatiquement sans briser votre flux d&apos;écriture.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
