'use client';

import Link from 'next/link';
import { useAuth } from '@/components/Auth/AuthProvider';
import LoginPage from '@/components/Auth/LoginPage';

export default function Dashboard() {
  const { user, loading, manuscript, penName } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-soft)', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, letterSpacing: '.08em' }}>
        Chargement...
      </div>
    );
  }

  // Not logged in → show landing page
  if (!user) {
    return <LoginPage />;
  }

  // Logged in → show dashboard
  const displayName = penName || user.displayName?.split(' ')[0] || 'Écrivain';

  return (
    <>
      <style>{`
        .home-dash {
          display: flex; flex-direction: column; align-items: center;
          flex: 1; min-height: 0; overflow-y: auto;
          padding: 0 24px 60px;
        }
        .home-welcome {
          text-align: center; padding: 48px 0 36px;
          max-width: 520px; width: 100%;
          animation: fadeIn .6s ease both;
        }
        .home-greeting {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 600; color: var(--text);
          margin: 0 0 8px;
        }
        .home-sub {
          font-size: 14.5px; color: var(--text-soft);
          line-height: 1.6; margin: 0;
        }
        .home-manuscript-badge {
          display: inline-block; margin-top: 14px;
          background: rgba(138,90,52,0.08);
          border: 1px solid rgba(138,90,52,0.15);
          padding: 6px 16px; border-radius: 20px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; color: var(--accent);
          font-weight: 600;
        }

        .home-actions {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 16px; max-width: 600px; width: 100%;
          margin-bottom: 40px;
          animation: fadeIn .6s .1s ease both;
        }
        @media (max-width: 560px) {
          .home-actions { grid-template-columns: 1fr; }
        }
        .home-action {
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 28px 16px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          text-decoration: none; color: inherit;
          transition: all .25s;
        }
        .home-action:hover {
          border-color: var(--accent);
          transform: translateY(-3px);
          box-shadow: 0 6px 24px rgba(0,0,0,.07);
        }
        .home-action-icon { font-size: 32px; margin-bottom: 12px; }
        .home-action-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 600; color: var(--text);
          margin: 0 0 6px;
        }
        .home-action-desc {
          font-size: 12px; color: var(--text-soft); line-height: 1.5; margin: 0;
        }

        .home-tip {
          max-width: 500px; width: 100%;
          background: rgba(138,90,52,0.04);
          border: 1px solid rgba(138,90,52,0.12);
          border-radius: 12px; padding: 20px 24px;
          animation: fadeIn .6s .2s ease both;
        }
        .home-tip-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: .16em; text-transform: uppercase;
          color: var(--accent); margin: 0 0 10px;
        }
        
        @media (max-width: 768px) {
          .home-sub { font-size: 16px; }
          .home-manuscript-badge { font-size: 14px; padding: 8px 18px; }
          .home-action-title { font-size: 18px; }
          .home-action-desc { font-size: 14px; }
          .home-tip-title { font-size: 13px; }
          .home-tip-text { font-size: 15px !important; line-height: 1.6; }
        }
        .home-tip-text {
          font-size: 13px; color: var(--text-soft);
          line-height: 1.65; margin: 0;
        }
      `}</style>

      <div className="home-dash">
        <div className="home-welcome">
          <h1 className="home-greeting">Bienvenue, {displayName}</h1>
          <p className="home-sub">
            Votre atelier d&apos;écriture est prêt. Que souhaitez-vous faire aujourd&apos;hui ?
          </p>
          {manuscript && (
            <span className="home-manuscript-badge">
              📖 {manuscript.title}
            </span>
          )}
        </div>

        <div className="home-actions">
          <Link href="/atelier" className="home-action">
            <span className="home-action-icon">🎙️</span>
            <h2 className="home-action-title">Dicter</h2>
            <p className="home-action-desc">
              Enregistrez à voix haute.
              L&apos;IA transforme votre oral en premier jet structuré.
            </p>
          </Link>
          <Link href="/atelier" className="home-action">
            <span className="home-action-icon">✍️</span>
            <h2 className="home-action-title">Éditer</h2>
            <p className="home-action-desc">
              Travaillez votre manuscrit.
              Acceptez ou rejetez les suggestions de l&apos;IA.
            </p>
          </Link>
          <Link href="/liseuse" className="home-action">
            <span className="home-action-icon">📖</span>
            <h2 className="home-action-title">Lire</h2>
            <p className="home-action-desc">
              Relisez votre texte comme un vrai livre, page par page.
            </p>
          </Link>
        </div>

        <div className="home-tip">
          <h3 className="home-tip-title">💡 Astuce du jour</h3>
          <p className="home-tip-text">
            <strong>Le mode dictée est intelligent.</strong> Quand vous dites « non, plutôt… »
            ou « en fait, je voulais dire… », Gemini comprend que c&apos;est une rature.
            Il conserve les deux versions et vous laisse choisir.
            Parlez comme vous pensez — l&apos;IA s&apos;adapte à votre processus.
          </p>
        </div>
      </div>
    </>
  );
}
