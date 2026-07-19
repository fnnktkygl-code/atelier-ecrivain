'use client';

import { useAuth } from './AuthProvider';

export default function LoginPage() {
  const { signIn, loading } = useAuth();

  const features = [
    {
      icon: '🎙️',
      title: 'Dictée vocale intelligente',
      desc: 'Parlez librement, comme un brouillon oral. L\'IA transcrit, identifie vos hésitations, ratures et reformulations — exactement comme un vrai premier jet sur papier.',
    },
    {
      icon: '✂️',
      title: 'Ratures & corrections IA',
      desc: 'Gemini détecte vos auto-corrections en temps réel. Quand vous dites « non, plutôt… », l\'IA comprend et vous propose les deux versions à comparer.',
    },
    {
      icon: '📖',
      title: 'Liseuse intégrée',
      desc: 'Relisez votre manuscrit comme un vrai livre, page par page ou en défilement continu, avec surlignage et navigation fluide.',
    },
    {
      icon: '🔒',
      title: 'Votre espace privé',
      desc: 'Chaque auteur a son espace sécurisé. Vos manuscrits ne sont accessibles que par vous, nulle part ailleurs.',
    },
  ];

  return (
    <>
      <style>{`
        .landing {
          display: flex; flex-direction: column;
          align-items: center; flex: 1; min-height: 0;
          overflow-y: auto; padding: 0 24px 60px;
        }

        /* ── Hero ── */
        .landing-hero {
          text-align: center; padding: 56px 0 40px;
          max-width: 600px; width: 100%;
          animation: fadeIn .7s ease both;
        }
        .landing-badge {
          display: inline-block;
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; letter-spacing: .18em;
          text-transform: uppercase; color: var(--accent);
          background: rgba(138,90,52,0.08);
          padding: 6px 16px; border-radius: 20px;
          margin-bottom: 20px;
        }
        .landing-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(32px, 5vw, 44px);
          font-weight: 600; color: var(--text);
          margin: 0 0 12px; line-height: 1.2;
        }
        .landing-tagline {
          font-family: 'Source Serif 4', serif;
          font-size: clamp(15px, 2vw, 17px);
          color: var(--text-soft); margin: 0 0 8px;
          line-height: 1.7; max-width: 500px;
          margin-left: auto; margin-right: auto;
        }
        .landing-vision {
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px; font-style: italic;
          color: var(--accent); margin: 16px 0 0;
          opacity: .85; line-height: 1.5;
        }

        /* ── CTA ── */
        .landing-cta {
          text-align: center;
          margin: 8px 0 48px;
          animation: fadeIn .7s .15s ease both;
        }
        .landing-google-btn {
          display: inline-flex; align-items: center; gap: 12px;
          padding: 14px 32px;
          background: var(--text); color: var(--bg);
          border: none; border-radius: 10px;
          font-family: 'Source Serif 4', serif;
          font-size: 15.5px; font-weight: 500;
          cursor: pointer; transition: all .25s ease;
          letter-spacing: .02em;
          box-shadow: 0 2px 12px rgba(0,0,0,.08);
        }
        .landing-google-btn:hover {
          opacity: .88; transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,.15);
        }
        .landing-google-btn:disabled { opacity: .5; cursor: wait; }
        .landing-google-btn svg { width: 20px; height: 20px; }
        .landing-cta-sub {
          font-size: 12px; color: var(--text-soft);
          margin-top: 12px; opacity: .6;
        }

        /* ── How it Works ── */
        .landing-how {
          max-width: 600px; width: 100%;
          margin-bottom: 48px;
          animation: fadeIn .7s .25s ease both;
        }
        .landing-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: .2em; text-transform: uppercase;
          color: var(--accent); text-align: center;
          margin: 0 0 28px;
        }
        .how-steps {
          display: flex; flex-direction: column; gap: 0;
          position: relative;
        }
        .how-step {
          display: flex; gap: 20px;
          align-items: flex-start;
          padding: 20px 0;
          position: relative;
        }
        .how-step + .how-step { border-top: 1px solid var(--border); }
        .how-number {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(138,90,52,.08);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 600; color: var(--accent);
          flex-shrink: 0;
        }
        .how-content { flex: 1; }
        .how-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px; font-weight: 600; color: var(--text);
          margin: 0 0 4px;
        }
        .how-desc {
          font-size: 13.5px; color: var(--text-soft); line-height: 1.6; margin: 0;
        }

        /* ── Features ── */
        .landing-features {
          max-width: 640px; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
          animation: fadeIn .7s .35s ease both;
        }
        @media (max-width: 560px) {
          .landing-features { grid-template-columns: 1fr; }
        }
        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px; padding: 24px 20px;
          transition: all .25s;
        }
        .feature-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,.06);
        }
        .feature-icon {
          font-size: 28px; margin-bottom: 12px; display: block;
        }
        .feature-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 600; color: var(--text);
          margin: 0 0 6px;
        }
        .feature-desc {
          font-size: 12.5px; color: var(--text-soft);
          line-height: 1.55; margin: 0;
        }

        /* ── Footer ── */
        .landing-footer {
          text-align: center; margin-top: 48px;
          animation: fadeIn .7s .45s ease both;
        }
        .landing-footer-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; color: var(--text-soft);
          font-style: italic; opacity: .6;
        }
      `}</style>

      <div className="landing">
        {/* ── Hero ── */}
        <div className="landing-hero">
          <span className="landing-badge">Atelier d&apos;Écriture Numérique</span>
          <h1 className="landing-title">
            Écrivez comme sur papier,
            <br />
            avec la puissance de l&apos;IA
          </h1>
          <p className="landing-tagline">
            Dictez votre manuscrit à voix haute, comme un premier brouillon.
            L&apos;intelligence artificielle transcrit, détecte vos ratures,
            reformulations et hésitations — pour recréer le processus naturel
            d&apos;écriture.
          </p>
          <p className="landing-vision">
            « Écrire, c&apos;est d&apos;abord jeter ses idées. L&apos;IA les attrape au vol. »
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="landing-cta">
          <button
            className="landing-google-btn"
            onClick={signIn}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Chargement...' : 'Commencer à écrire'}
          </button>
          <p className="landing-cta-sub">
            Gratuit · Connexion sécurisée via Google · Vos données restent privées
          </p>
        </div>

        {/* ── How it Works ── */}
        <div className="landing-how">
          <h2 className="landing-section-title">🪶 Comment ça marche</h2>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-number">1</div>
              <div className="how-content">
                <h3 className="how-title">Dictez votre premier jet</h3>
                <p className="how-desc">
                  Appuyez sur le bouton micro et parlez naturellement.
                  Hésitez, reprenez-vous, changez d&apos;avis — comme sur un vrai brouillon papier.
                </p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-number">2</div>
              <div className="how-content">
                <h3 className="how-title">L&apos;IA analyse et structure</h3>
                <p className="how-desc">
                  Gemini identifie vos <strong>ratures vocales</strong> (« non, plutôt… »),
                  sépare les paragraphes, et vérifie vos citations et références
                  bibliques automatiquement.
                </p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-number">3</div>
              <div className="how-content">
                <h3 className="how-title">Révisez et affinez</h3>
                <p className="how-desc">
                  Acceptez ou rejetez chaque suggestion de l&apos;IA.
                  Éditez directement le texte, ajoutez des notes, et exportez en Markdown.
                </p>
              </div>
            </div>
            <div className="how-step">
              <div className="how-number">4</div>
              <div className="how-content">
                <h3 className="how-title">Lisez comme un livre</h3>
                <p className="how-desc">
                  La liseuse intégrée transforme votre manuscrit en expérience Kindle :
                  pagination fluide, mode page ou défilement, surlignage de passages.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features Grid ── */}
        <div className="landing-features">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <span className="feature-icon">{f.icon}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="landing-footer">
          <p className="landing-footer-text">
            Conçu pour les écrivains qui pensent à voix haute.
          </p>
        </div>
      </div>
    </>
  );
}
