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
            <IconBook size={15} strokeWidth={2} />
            <span className="manuscript-badge-label">Manuscrit actif :</span>
            <span className="manuscript-badge-title">{manuscript.title}</span>
            <IconChevronRight size={14} strokeWidth={2} className="manuscript-badge-arrow" />
          </Link>
        )}
      </header>

      <section className="home-actions" aria-label="Actions principales">
        <Link href="/atelier" className="home-action">
          <div className="home-action-icon-wrap">
            <IconMic size={24} strokeWidth={1.8} />
          </div>
          <h2 className="home-action-title">Dicter</h2>
          <p className="home-action-desc">
            Enregistrez à voix haute. L&apos;IA Gemini transcrit et structure votre oral en premier jet fidèle.
          </p>
        </Link>
        <Link href="/atelier" className="home-action">
          <div className="home-action-icon-wrap">
            <IconFeather size={24} strokeWidth={1.8} />
          </div>
          <h2 className="home-action-title">Éditer</h2>
          <p className="home-action-desc">
            Façonnez votre manuscrit. Examinez les suggestions stylistiques, les ratures et les annotations.
          </p>
        </Link>
        <Link href="/liseuse" className="home-action">
          <div className="home-action-icon-wrap">
            <IconBook size={24} strokeWidth={1.8} />
          </div>
          <h2 className="home-action-title">Lire</h2>
          <p className="home-action-desc">
            Relisez votre texte dans une mise en page d&apos;édition soignée, sans distraction.
          </p>
        </Link>
      </section>

      <aside className="home-tip" aria-label="Conseil d'écriture">
        <div className="home-tip-header">
          <IconLightbulb size={16} strokeWidth={2} />
          <h3 className="home-tip-title">Conseil de l&apos;Atelier</h3>
        </div>
        <p className="home-tip-text">
          <strong>La dictée préserve votre élan naturel.</strong> Lorsque vous vous reprenez (« en fait… », « non, plutôt… »),
          le système isole la rature et retient l&apos;intention corrigée sans briser votre flux d&apos;écriture.
        </p>
      </aside>
    </div>
  );
}
