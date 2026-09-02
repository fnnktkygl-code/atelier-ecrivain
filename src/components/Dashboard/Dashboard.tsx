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

const LITERARY_QUOTES = [
  { text: 'Écrire, c’est aussi ne pas parler. C’est se taire. C’est hurler sans bruit.', author: 'Marguerite Duras' },
  { text: 'Ne cherchez pas à écrire bien, cherchez à écrire vrai.', author: 'Virginia Woolf' },
  { text: 'Le style est une question non de technique, mais de vision.', author: 'Marcel Proust' },
  { text: 'Créer, c’est vivre deux fois.', author: 'Albert Camus' },
  { text: 'Un livre doit être la hache qui brise la mer gelée en nous.', author: 'Franz Kafka' },
  { text: 'La dictée préserve l’élan : vos repentirs et ratures orales nourrissent le texte sans briser votre souffle.', author: 'Atelier de l’Écrivain' },
];

export default function Dashboard() {
  const { user, loading, manuscript, penName, manuscripts } = useAuth();
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * LITERARY_QUOTES.length));

  if (loading) {
    return (
      <div className="dash-loading-state">
        <span className="loading-spinner" />
        <span>Préparation de votre sanctuaire d&apos;écriture…</span>
      </div>
    );
  }

  // Non connecté → Vitrine d'accueil publique de luxe
  if (!user) {
    return <LoginPage />;
  }

  const displayName = penName || user.displayName?.split(' ')[0] || 'Écrivain';

  // Salutation contextuelle poétique selon l'heure
  const hour = new Date().getHours();
  const timeGreeting =
    hour >= 5 && hour < 12
      ? "Encre de l'aube"
      : hour >= 12 && hour < 18
      ? 'Studio littéraire'
      : hour >= 18 && hour < 23
      ? 'Écriture du crépuscule'
      : 'Veilleuse de nuit';

  const currentQuote = LITERARY_QUOTES[quoteIndex] || LITERARY_QUOTES[0];

  return (
    <div className="home-dash">
      <div className="home-dash-inner">
        {/* ── 1. En-tête Poétique & Sérénité (Japandi Ma) ── */}
        <header className="home-welcome">
          <div className="home-welcome-meta">
            <span className="home-welcome-eyebrow">{timeGreeting}</span>
            <span className="home-welcome-dot" />
            <span className="home-welcome-count">
              {manuscripts.length} {manuscripts.length > 1 ? 'manuscrits' : 'manuscrit'}
            </span>
          </div>
          <h1 className="home-greeting">Bienvenue, {displayName}</h1>
          <p className="home-sub">
            Votre sanctuaire créatif est prêt. Reprenez votre fil narratif ou explorez une nouvelle voix.
          </p>
        </header>

        {/* ── 2. Carte Héroïque : Le Manuscrit en Cours ── */}
        {manuscript ? (
          <div className="hero-manuscript-card">
            <div className="hero-book-cover-preview">
              <div className="hero-book-spine" />
              <div className="hero-book-cover-surface">
                <IconFeather size={20} className="hero-book-icon" />
                <span className="hero-book-cover-title">{manuscript.title}</span>
                <span className="hero-book-cover-author">{displayName}</span>
              </div>
            </div>

            <div className="hero-manuscript-info">
              <div className="hero-manuscript-status">
                <span className="hero-status-dot" />
                <span className="hero-status-label">Manuscrit en cours</span>
              </div>

              <h2 className="hero-manuscript-title">{manuscript.title}</h2>

              <p className="hero-manuscript-details">
                Poursuivez la rédaction, consultez les ratures de style assistées par IA ou explorez vos notes de marge.
              </p>

              <div className="hero-manuscript-actions">
                <Link href="/atelier" className="btn btn-primary hero-btn-write">
                  <IconFeather size={16} strokeWidth={2} />
                  <span>Reprendre l&apos;écriture</span>
                </Link>
                <Link href="/liseuse" className="btn btn-secondary hero-btn-read">
                  <IconBook size={16} strokeWidth={1.8} />
                  <span>Mode Liseuse</span>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-manuscript-card empty">
            <div className="hero-manuscript-info" style={{ textAlign: 'center', width: '100%', alignItems: 'center' }}>
              <IconCompass size={32} strokeWidth={1.5} className="empty-hero-icon" />
              <h2 className="hero-manuscript-title">Aucun manuscrit sélectionné</h2>
              <p className="hero-manuscript-details">
                Commencez un nouvel ouvrage ou importez vos notes pour démarrer votre session.
              </p>
              <Link href="/atelier" className="btn btn-primary" style={{ marginTop: 8 }}>
                <IconFeather size={16} />
                <span>Ouvrir l&apos;Atelier</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── 3. Piliers d'Action Rapide ── */}
        <div className="home-quick-pillars">
          <Link href="/atelier" className="pillar-card">
            <div className="pillar-icon-box">
              <IconMic size={20} strokeWidth={2} />
            </div>
            <div className="pillar-content">
              <div className="pillar-header">
                <h3 className="pillar-title">Dictée Vocale Assistée</h3>
                <span className="pillar-badge">Gemini 3.5 Transcribe</span>
              </div>
              <p className="pillar-desc">
                Dictez votre premier jet à voix haute. L&apos;IA isole les auto-corrections et structure vos chapitres.
              </p>
            </div>
            <IconChevronRight size={16} className="pillar-chevron" />
          </Link>

          <Link href="/liseuse" className="pillar-card">
            <div className="pillar-icon-box">
              <IconSparkles size={20} strokeWidth={2} />
            </div>
            <div className="pillar-content">
              <div className="pillar-header">
                <h3 className="pillar-title">Studio de Relecture & Export</h3>
                <span className="pillar-badge">Édition & PDF</span>
              </div>
              <p className="pillar-desc">
                Relisez sans distraction, personnalisez les 10 thèmes éditoriaux et exportez votre livre relié.
              </p>
            </div>
            <IconChevronRight size={16} className="pillar-chevron" />
          </Link>
        </div>

        {/* ── 4. Signet Littéraire (Sagesse & Inspiration Washi) ── */}
        <footer className="home-quote-bookmark" onClick={() => setQuoteIndex((prev) => (prev + 1) % LITERARY_QUOTES.length)}>
          <span className="quote-mark">“</span>
          <p className="quote-text">
            {currentQuote.text}
            <span className="quote-author">— {currentQuote.author}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
