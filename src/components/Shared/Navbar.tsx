'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/Auth/AuthProvider';
import ProfileDrawer from '@/components/Auth/ProfileDrawer';
import { IconHome, IconFeather, IconBook } from './Icons';

export default function Navbar() {
  const pathname = usePathname();
  const { user, manuscript, penName, avatarColor, avatarUrl } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links = [
    { href: '/', label: 'Accueil', Icon: IconHome },
    { href: '/atelier', label: 'Atelier', Icon: IconFeather },
    { href: '/liseuse', label: 'Liseuse', Icon: IconBook },
  ];

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <IconFeather size={18} className="navbar-brand-icon" />
          <span>Atelier d&apos;Écrivain</span>
        </div>
        <ul className="navbar-nav">
          {links.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
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
