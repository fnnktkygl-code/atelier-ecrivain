'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/Auth/AuthProvider';
import LoginPage from '@/components/Auth/LoginPage';
import {
  IconMic,
  IconFeather,
  IconBook,
  IconSparkles,
  IconCompass,
  IconChevronRight,
} from '@/components/Shared/Icons';

const LITERARY_SANCTUARY_QUOTES = [
  { text: 'Écrire, c’est aussi ne pas parler. C’est se taire. C’est hurler sans bruit.', author: 'Marguerite Duras' },
  { text: 'Ne cherchez pas à écrire bien, cherchez à écrire vrai.', author: 'Virginia Woolf' },
  { text: 'Le style est une question non de technique, mais de vision.', author: 'Marcel Proust' },
  { text: 'Créer, c’est vivre deux fois.', author: 'Albert Camus' },
  { text: 'Un livre doit être la hache qui brise la mer gelée en nous.', author: 'Franz Kafka' },
  { text: 'Dans le silence de l’encre, chaque mot posé est une pierre d’éternité.', author: 'Jun’ichirō Tanizaki' },
];

export default function Dashboard() {
  const { user, loading, manuscript, penName, manuscripts } = useAuth();
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * LITERARY_SANCTUARY_QUOTES.length));

  if (loading) {
    return (
      <div className="dash-loading-state">
        <span className="loading-spinner" />
        <span style={{ fontFamily: 'var(--font-serif-classic)', fontSize: '18px', fontStyle: 'italic', color: 'var(--text-soft)' }}>
          Harmonisation du sanctuaire…
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const displayName = penName || user.displayName?.split(' ')[0] || 'Écrivain';

  // Moment de la journée selon les rituels de l'encre et du thé
  const hour = new Date().getHours();
  const timeRitual =
    hour >= 5 && hour < 12
      ? "L'Encre de l'Aube"
      : hour >= 12 && hour < 18
      ? 'La Clarté du Jour'
      : hour >= 18 && hour < 23
      ? 'Le Calme du Crépuscule'
      : 'La Veilleuse Nocturne';

  const currentQuote = LITERARY_SANCTUARY_QUOTES[quoteIdx];

  return (
    <main className="sanctuary-wrapper">
      <div className="sanctuary-inner">
        {/* ── 1. En-tête Contemplatif (Principe du Ma) ── */}
        <header className="sanctuary-header">
          <div className="sanctuary-header-ritual">
            <span className="sanctuary-ritual-tag">{timeRitual}</span>
            <span className="sanctuary-ritual-dot" />
            <span className="sanctuary-ritual-count">
              {manuscripts.length} {manuscripts.length > 1 ? 'œuvres en gestation' : 'œuvre en cours'}
            </span>
          </div>

          <h1 className="sanctuary-greeting-title">
            Paix à votre plume, <em>{displayName}</em>.
          </h1>

          <p className="sanctuary-header-sub">
            Le sanctuaire est silencieux. Vos pensées peuvent s’épanouir sans obstacle.
          </p>
        </header>

        {/* ── 2. Le Manuscrit Actif (Volume 3D & Noblesse Tactile) ── */}
        {manuscript ? (
          <section className="sanctuary-hero-card" aria-label="Manuscrit en cours">
            {/* Rendu 3D du Livre Japandi */}
            <div className="book-3d-stage">
              <div className="book-3d-volume">
                <div className="book-3d-front">
                  <div className="book-3d-groove" />
                  <div className="book-3d-ribbon" />
                  <IconFeather size={18} className="book-3d-feather" />
                  <span className="book-3d-title">{manuscript.title}</span>
                  <span className="book-3d-author">{displayName}</span>
                </div>
                <div className="book-3d-pages-edge" />
              </div>
            </div>

            {/* Informations & Métriques d'art */}
            <div className="sanctuary-hero-meta">
              <div className="sanctuary-status-badge">
                <span className="sanctuary-status-dot" />
                <span>Manuscrit Actif</span>
              </div>

              <h2 className="sanctuary-hero-title">{manuscript.title}</h2>

              <p className="sanctuary-hero-details">
                Poursuivez la rédaction au point exact où vous l’avez laissée, dictez vos repentirs ou relisez vos chapitres.
              </p>

              <div className="sanctuary-actions-group">
                <Link href="/atelier" className="btn-sanctuary-primary" title="Continuer la rédaction dans l'Atelier">
                  <IconFeather size={15} strokeWidth={2} />
                  <span>Reprendre l&apos;écriture</span>
                </Link>
                <Link href="/atelier?action=dictate" className="btn-sanctuary-secondary" title="Armer immédiatement la dictée vocale">
                  <IconMic size={15} strokeWidth={1.8} />
                  <span>Dictée instantanée</span>
                </Link>
                <Link href="/liseuse" className="btn-sanctuary-tertiary" title="Feuilleter en mode liseuse">
                  <IconBook size={15} strokeWidth={1.8} />
                  <span>Liseuse</span>
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="sanctuary-hero-card empty">
            <div className="empty-sanctuary-content">
              <IconCompass size={36} strokeWidth={1.5} className="empty-hero-icon" />
              <h2 className="sanctuary-hero-title">Une feuille vierge attend votre voix</h2>
              <p className="sanctuary-hero-details">
                Commencez un nouvel ouvrage ou explorez les outils de l&apos;Atelier.
              </p>
              <Link href="/atelier" className="btn-sanctuary-primary" style={{ marginTop: 8 }}>
                <IconFeather size={15} strokeWidth={2} />
                <span>Ouvrir l&apos;Atelier d&apos;écriture</span>
              </Link>
            </div>
          </section>
        )}

        {/* ── 3. Portails de Création (Deux Piliers Épurés) ── */}
        <div className="sanctuary-pillars-grid">
          <Link href="/atelier?action=dictate" className="sanctuary-portal-card" title="Lancer une dictée vocale sans détour">
            <div className="sanctuary-portal-icon">
              <IconMic size={20} strokeWidth={1.8} />
            </div>
            <div className="sanctuary-portal-text">
              <h3 className="sanctuary-portal-title">Dictée & Repentirs Vivants</h3>
              <p className="sanctuary-portal-desc">
                Parlez sans filtre. L’intelligence de l’atelier isole vos ratures de votre texte pur.
              </p>
            </div>
            <IconChevronRight size={16} className="sanctuary-portal-chevron" />
          </Link>

          <Link href="/liseuse" className="sanctuary-portal-card" title="Ouvrir la liseuse et les exports">
            <div className="sanctuary-portal-icon">
              <IconSparkles size={20} strokeWidth={1.8} />
            </div>
            <div className="sanctuary-portal-text">
              <h3 className="sanctuary-portal-title">Relecture & Reliure d&apos;Art</h3>
              <p className="sanctuary-portal-desc">
                Admirez votre mise en page aux proportions d&apos;or et préparez l&apos;exportation d&apos;imprimerie.
              </p>
            </div>
            <IconChevronRight size={16} className="sanctuary-portal-chevron" />
          </Link>
        </div>

        {/* ── 4. Signet Poétique Interactif (Méditation Wabi-Sabi Accessible) ── */}
        <button
          type="button"
          className="sanctuary-quote-bookmark"
          onClick={() => setQuoteIdx((prev) => (prev + 1) % LITERARY_SANCTUARY_QUOTES.length)}
          title="Toucher pour renouveler la pensée littéraire"
          aria-label="Changer de citation littéraire inspirante"
        >
          <span className="quote-mark">“</span>
          <p className="sanctuary-quote-text">
            {currentQuote.text}
            <span className="sanctuary-quote-author">— {currentQuote.author}</span>
          </p>
          <span className="sanctuary-quote-refresh">Toucher le signet ✦</span>
        </button>
      </div>
    </main>
  );
}
