'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/Auth/AuthProvider';
import ProfileDrawer from '@/components/Auth/ProfileDrawer';

export default function Navbar() {
  const pathname = usePathname();
  const { user, manuscript, penName, avatarColor, avatarUrl } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links = [
    { href: '/', label: 'Accueil', icon: '🏠' },
    { href: '/atelier', label: 'Atelier', icon: '✍️' },
    { href: '/liseuse', label: 'Liseuse', icon: '📖' },
  ];

  return (
    <>
      <style>{`
        .user-section {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 12px;
        }
        .avatar-btn {
          background: none; border: none; padding: 0;
          cursor: pointer; position: relative;
          display: flex; align-items: center; gap: 10px;
          transition: opacity .2s;
        }
        .avatar-btn:hover { opacity: .85; }
        .user-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid var(--accent);
          object-fit: cover;
          transition: box-shadow .2s;
        }
        .avatar-btn:hover .user-avatar {
          box-shadow: 0 0 0 3px rgba(138,90,52,0.15);
        }
        .avatar-placeholder {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--accent); color: var(--bg);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600;
          font-family: 'Cormorant Garamond', serif;
          border: 2px solid var(--accent);
        }
        .user-meta {
          display: flex; flex-direction: column; align-items: flex-start;
        }
        .user-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; font-weight: 600;
          color: var(--text);
          line-height: 1.2;
        }
        .user-manuscript {
          font-size: 10.5px; color: var(--text-soft);
          max-width: 260px;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .user-meta { display: none; }
        }
      `}</style>

      <nav className="navbar">
        <div className="navbar-brand">Atelier d&apos;Écrivain</div>
        <ul className="navbar-nav">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`nav-link ${pathname === link.href ? 'active' : ''}`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        {user && (
          <div className="user-section">
            <button className="avatar-btn" onClick={() => setDrawerOpen(true)} aria-label="Mon profil">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={penName || user.displayName || 'Avatar'}
                  className="user-avatar"
                />
              ) : (
                <div className="avatar-placeholder" style={avatarColor ? { background: avatarColor } : {}}>
                  {(penName || user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="user-meta">
                <span className="user-name">{(penName || user.displayName || '').split(' ')[0]}</span>
                {manuscript && <span className="user-manuscript">{manuscript.title}</span>}
              </div>
            </button>
          </div>
        )}
      </nav>

      <ProfileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
