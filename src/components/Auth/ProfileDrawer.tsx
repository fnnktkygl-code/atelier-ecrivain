'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';

export default function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, manuscript, manuscripts, penName, avatarColor, avatarUrl, showEmail, updatePenName, renameManuscript, logOut, selectManuscript, addManuscript, updateProfileSettings } = useAuth();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        // Crop to square from center
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        updateProfileSettings({ avatarUrl: dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    updateProfileSettings({ avatarUrl: '' });
  };

  useEffect(() => {
    setEditNameValue(penName || user?.displayName || 'Écrivain');
  }, [penName, user]);

  if (!user) return null;

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await addManuscript(title);
      setNewTitle('');
      setShowNewForm(false);
    } catch (err) {
      console.error('Error creating manuscript:', err);
    }
    setCreating(false);
  };

  const handleSaveName = async () => {
    const newName = editNameValue.trim();
    if (newName && newName !== (penName || user.displayName)) {
      await updatePenName(newName);
    }
    setIsEditingName(false);
  };

  const handleSelect = (m: typeof manuscripts[0]) => {
    selectManuscript(m);
    onClose();
  };

  const memberSince = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <style>{`
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(0,0,0,0.35); backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity .3s ease;
        }
        .drawer-overlay.open { opacity: 1; pointer-events: auto; }

        .profile-drawer {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 360px; max-width: 90vw; z-index: 1000;
          background: var(--surface);
          box-shadow: -8px 0 32px rgba(0,0,0,.12);
          transform: translateX(100%);
          transition: transform .32s cubic-bezier(.22,.68,0,1);
          display: flex; flex-direction: column;
          overflow-y: auto;
        }
        .profile-drawer.open { transform: translateX(0); }

        .drawer-header {
          padding: 32px 28px 24px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 16px;
        }
        .drawer-avatar {
          width: 56px; height: 56px; border-radius: 50%;
          border: 3px solid var(--accent);
          object-fit: cover; flex-shrink: 0;
        }
        .drawer-avatar-placeholder {
          width: 56px; height: 56px; border-radius: 50%;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: #fff; font-weight: 600;
          font-family: 'Cormorant Garamond', serif;
          flex-shrink: 0; cursor: pointer; position: relative;
          transition: opacity .2s;
        }
        .drawer-avatar-placeholder:hover { opacity: .85; }
        .avatar-edit-hint {
          position: absolute; bottom: -2px; right: -2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--surface); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
        }
        .color-picker-row {
          display: flex; gap: 6px; flex-wrap: wrap;
          padding: 10px 0;
        }
        .color-dot {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid transparent; cursor: pointer;
          transition: all .15s;
        }
        .color-dot:hover { transform: scale(1.15); }
        .color-dot.active { border-color: var(--text); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
        .email-toggle {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 0; cursor: pointer;
        }
        .email-toggle-switch {
          width: 36px; height: 20px; border-radius: 10px;
          background: var(--border); position: relative;
          transition: background .2s; flex-shrink: 0;
        }
        .email-toggle-switch.on { background: var(--accent); }
        .email-toggle-switch::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 16px; height: 16px; border-radius: 50%;
          background: white; transition: transform .2s;
          box-shadow: 0 1px 3px rgba(0,0,0,.15);
        }
        .email-toggle-switch.on::after { transform: translateX(16px); }
        .drawer-user-info { flex: 1; min-width: 0; }
        .drawer-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 600; color: var(--text);
          margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          cursor: pointer; display: inline-block;
          border-bottom: 1px dashed transparent;
          transition: border-color .2s;
        }
        .drawer-name:hover {
          border-bottom-color: var(--text-soft);
        }
        .drawer-name-input {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 600; color: var(--text);
          margin: 0; width: 100%; border: none; background: transparent;
          border-bottom: 1px solid var(--accent); outline: none;
          padding: 0;
        }
        .drawer-email {
          font-size: 12.5px; color: var(--text-soft);
          margin: 2px 0 0; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .drawer-member {
          font-size: 11px; color: var(--accent);
          font-family: 'Cormorant Garamond', serif;
          letter-spacing: .06em; margin-top: 4px;
        }
        .drawer-close {
          position: absolute; top: 16px; right: 16px;
          background: none; border: none; color: var(--text-soft);
          font-size: 22px; cursor: pointer; width: 36px; height: 36px;
          border-radius: 50%; display: flex; align-items: center;
          justify-content: center; transition: all .2s;
        }
        .drawer-close:hover { background: var(--hover); color: var(--text); }

        .drawer-section {
          padding: 20px 28px;
        }
        .drawer-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--accent); margin: 0 0 14px;
        }

        .manuscript-list { list-style: none; margin: 0; padding: 0; }
        .manuscript-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 10px;
          cursor: pointer; transition: all .18s;
          margin-bottom: 4px; border: 1px solid transparent;
        }
        .manuscript-item:hover { background: var(--hover); }
        .manuscript-item.active {
          background: rgba(138,90,52,0.08);
          border-color: var(--accent);
        }
        .manuscript-icon {
          font-size: 20px; flex-shrink: 0;
          width: 36px; height: 36px; border-radius: 8px;
          background: var(--hover);
          display: flex; align-items: center; justify-content: center;
        }
        .manuscript-item.active .manuscript-icon {
          background: rgba(138,90,52,0.15);
        }
        .manuscript-info { flex: 1; min-width: 0; }
        .manuscript-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 600; color: var(--text);
          margin: 0; white-space: normal; line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; text-overflow: ellipsis;
          cursor: pointer;
          border-bottom: 1px dashed transparent;
          transition: border-color .2s;
        }
        .manuscript-title:hover {
          border-bottom-color: var(--text-soft);
        }
        .manuscript-title-input {
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px; font-weight: 600; color: var(--text);
          margin: 0; width: 100%; border: none; background: transparent;
          border-bottom: 1px solid var(--accent); outline: none;
          padding: 0; line-height: 1.3;
        }
        .manuscript-date {
          font-size: 11px; color: var(--text-soft); margin-top: 2px;
        }
        .manuscript-active-badge {
          font-size: 9px; background: var(--accent); color: var(--bg);
          padding: 2px 8px; border-radius: 10px;
          font-family: 'Cormorant Garamond', serif;
          letter-spacing: .06em; font-weight: 600;
        }

        .new-manuscript-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 10px;
          background: none; border: 1px dashed var(--border);
          cursor: pointer; width: 100%;
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px; color: var(--text-soft);
          transition: all .18s; margin-top: 8px;
        }
        .new-manuscript-btn:hover {
          border-color: var(--accent); color: var(--accent);
          background: rgba(138,90,52,0.04);
        }

        .new-form { margin-top: 12px; }
        .new-form input {
          width: 100%; padding: 10px 14px;
          border: 1px solid var(--border); border-radius: 8px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px; color: var(--text);
          background: var(--bg); outline: none;
          transition: border-color .2s;
        }
        .new-form input:focus { border-color: var(--accent); }
        .new-form-actions {
          display: flex; gap: 8px; margin-top: 10px;
        }
        .new-form-actions button {
          flex: 1; padding: 8px 0; border-radius: 8px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; cursor: pointer; transition: all .2s;
          border: 1px solid var(--border);
        }
        .btn-create {
          background: var(--text); color: var(--bg); border-color: var(--text) !important;
        }
        .btn-create:hover { opacity: .85; }
        .btn-create:disabled { opacity: .5; cursor: wait; }
        .btn-cancel { background: none; color: var(--text-soft); }
        .btn-cancel:hover { background: var(--hover); }

        .drawer-divider {
          height: 1px; background: var(--border); margin: 0 28px;
        }

        .drawer-footer {
          margin-top: auto; padding: 20px 28px 28px;
          border-top: 1px solid var(--border);
        }
        .drawer-logout-btn {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; width: 100%; padding: 11px 0;
          border: 1px solid var(--border); border-radius: 10px;
          background: none; color: var(--text-soft);
          font-family: 'Cormorant Garamond', serif;
          font-size: 13.5px; letter-spacing: .04em;
          cursor: pointer; transition: all .2s;
        }
        .drawer-logout-btn:hover {
          border-color: #c44; color: #c44;
          background: rgba(204,68,68,.04);
        }
      `}</style>

      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose} />

      <div className={`profile-drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={onClose} aria-label="Fermer">×</button>

        {/* ── Header: Avatar + Info ── */}
        <div className="drawer-header">
          {/* Avatar: custom photo > color placeholder */}
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="drawer-avatar"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowColorPicker(!showColorPicker)}
            />
          ) : (
            <div
              className="drawer-avatar-placeholder"
              style={avatarColor ? { background: avatarColor } : {}}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Personnaliser l'avatar"
            >
              {(penName || user.displayName || user.email || '?')[0].toUpperCase()}
              <span className="avatar-edit-hint">✏️</span>
            </div>
          )}
          <div className="drawer-user-info">
            {isEditingName ? (
              <input
                className="drawer-name-input"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
            ) : (
              <h2 className="drawer-name" onClick={() => setIsEditingName(true)} title="Modifier le nom d'auteur">
                {penName || user.displayName || 'Écrivain'}
              </h2>
            )}
            {showEmail && <p className="drawer-email">{user.email}</p>}
            {memberSince && <p className="drawer-member">Membre depuis {memberSince}</p>}
          </div>
        </div>

        {/* ── Avatar settings ── */}
        {showColorPicker && (
          <div className="drawer-section" style={{ paddingTop: 0, paddingBottom: 12 }}>
            {/* Photo upload */}
            <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: "'Cormorant Garamond', serif", letterSpacing: '.08em', marginBottom: 8 }}>
              Photo de profil
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 12,
                  color: 'var(--text-soft)', cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                📷 Choisir une photo
              </button>
              {avatarUrl && (
                <button
                  onClick={removePhoto}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 12,
                    color: '#c44', cursor: 'pointer',
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>

            {/* Color picker (only when no custom photo) */}
            {!avatarUrl && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-soft)', fontFamily: "'Cormorant Garamond', serif", letterSpacing: '.08em', marginBottom: 6 }}>
                  Couleur de l’avatar
                </div>
                <div className="color-picker-row">
                  {['#8a5a34', '#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#e74c3c', '#3498db', '#1abc9c', '#f39c12'].map((c) => (
                    <button
                      key={c}
                      className={`color-dot ${avatarColor === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateProfileSettings({ avatarColor: c })}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="email-toggle" onClick={() => updateProfileSettings({ showEmail: !showEmail })}>
              <div className={`email-toggle-switch ${showEmail ? 'on' : ''}`} />
              <span style={{ fontSize: 12.5, color: 'var(--text-soft)', fontFamily: "'Cormorant Garamond', serif" }}>
                Afficher l’email
              </span>
            </div>
          </div>
        )}

        {/* ── Manuscripts ── */}
        <div className="drawer-section">
          <h3 className="drawer-section-title">📚 Mes Manuscrits</h3>
          <ul className="manuscript-list">
            {manuscripts.map((m) => (
              <li
                key={m.id}
                className={`manuscript-item ${manuscript?.id === m.id ? 'active' : ''}`}
                onClick={() => handleSelect(m)}
              >
                <div className="manuscript-icon">📖</div>
                <div className="manuscript-info">
                  {editingTitleId === m.id ? (
                    <input
                      className="manuscript-title-input"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={async () => {
                        const t = editTitleValue.trim();
                        if (t && t !== m.title) await renameManuscript(m.id, t);
                        setEditingTitleId(null);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const t = editTitleValue.trim();
                          if (t && t !== m.title) await renameManuscript(m.id, t);
                          setEditingTitleId(null);
                        }
                        if (e.key === 'Escape') setEditingTitleId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <p
                      className="manuscript-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTitleId(m.id);
                        setEditTitleValue(m.title);
                      }}
                      title="Double-cliquez pour renommer"
                    >
                      {m.title}
                    </p>
                  )}
                  <p className="manuscript-date">
                    {m.createdAt && typeof (m.createdAt as { toDate?: () => Date }).toDate === 'function'
                      ? (m.createdAt as { toDate: () => Date }).toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                      : ''}
                  </p>
                </div>
                {manuscript?.id === m.id && (
                  <span className="manuscript-active-badge">ACTIF</span>
                )}
              </li>
            ))}
          </ul>

          {!showNewForm ? (
            <button className="new-manuscript-btn" onClick={() => setShowNewForm(true)}>
              <span style={{ fontSize: 18 }}>＋</span>
              <span>Nouveau manuscrit</span>
            </button>
          ) : (
            <div className="new-form">
              <input
                type="text"
                placeholder="Titre du manuscrit..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <div className="new-form-actions">
                <button className="btn-cancel" onClick={() => { setShowNewForm(false); setNewTitle(''); }}>
                  Annuler
                </button>
                <button className="btn-create" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                  {creating ? '...' : 'Créer'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Logout ── */}
        <div className="drawer-footer">
          <button className="drawer-logout-btn" onClick={() => { logOut(); onClose(); }}>
            <span>🚪</span>
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </>
  );
}
