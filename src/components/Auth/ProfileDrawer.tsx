import { useState, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { useTheme } from '@/components/Shared/ThemeProvider';
import {
  IconClose,
  IconEdit,
  IconBook,
  IconPlus,
  IconPalette,
  IconSun,
  IconMoon,
  IconCompass,
  IconShield,
  IconDownload,
} from '@/components/Shared/Icons';

export default function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    user,
    manuscript,
    manuscripts,
    penName,
    avatarColor,
    avatarUrl,
    showEmail,
    updatePenName,
    renameManuscript,
    logOut,
    selectManuscript,
    addManuscript,
    deleteManuscript,
    updateProfileSettings,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(() => penName || user?.displayName || 'Écrivain');
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

  if (!user || !open) return null;

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

  const handleSelect = (m: (typeof manuscripts)[0]) => {
    selectManuscript(m);
    onClose();
  };

  const memberSince = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '';

  const AVATAR_COLORS = [
    '#C07D49',
    '#466353',
    '#BA5A45',
    '#4A6B82',
    '#7D6B90',
    '#5C5549',
    '#8A5A34',
    '#3D5A50',
  ];

  return (
    <div className="drawer-portal-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <div
        className="drawer-overlay open"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(18, 18, 17, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <div
        className="profile-drawer open"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(380px, 100vw)',
          height: '100vh',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 36px rgba(0,0,0,0.25)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 20,
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="chapter-list-header" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="sidebar-section-title" style={{ margin: 0, fontSize: 16 }}>Profil & Paramètres</h3>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-soft)', padding: 4 }}>
            <IconClose size={18} strokeWidth={2} />
          </button>
        </div>

        {/* User Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="user-avatar"
              style={{ width: 52, height: 52, cursor: 'pointer' }}
              onClick={() => setShowColorPicker(!showColorPicker)}
            />
          ) : (
            <div
              className="avatar-placeholder"
              style={{
                width: 52,
                height: 52,
                fontSize: 20,
                background: avatarColor || 'var(--accent)',
                cursor: 'pointer',
              }}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Personnaliser l'avatar"
            >
              {(penName || user.displayName || user.email || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditingName ? (
              <input
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--accent)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif-classic)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  {penName || user.displayName || 'Écrivain'}
                </span>
                <button
                  onClick={() => setIsEditingName(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                  title="Modifier le nom d'auteur"
                >
                  <IconEdit size={13} />
                </button>
              </div>
            )}
            {showEmail && <p style={{ fontSize: 11.5, color: 'var(--text-soft)', marginTop: 2 }}>{user.email}</p>}
            {memberSince && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Membre depuis {memberSince}</p>}
          </div>
        </div>

        {/* Color / Photo Picker */}
        {showColorPicker && (
          <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)', marginBottom: 8 }}>
              Photo & Couleur d&apos;avatar
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1 }}
              >
                Choisir une photo
              </button>
              {avatarUrl && (
                <button
                  className="btn btn-ghost btn-sm danger"
                  onClick={removePhoto}
                >
                  Supprimer
                </button>
              )}
            </div>
            {!avatarUrl && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateProfileSettings({ avatarColor: c })}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: avatarColor === c ? '2px solid var(--text)' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manuscripts list */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconBook size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              Mes Manuscrits ({manuscripts.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {manuscripts.map((m) => {
              const isActive = m.id === manuscript?.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'var(--accent-glow)' : 'var(--surface-2)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  {editingTitleId === m.id ? (
                    <input
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={async () => {
                        if (editTitleValue.trim()) await renameManuscript(m.id, editTitleValue.trim());
                        setEditingTitleId(null);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && editTitleValue.trim()) {
                          await renameManuscript(m.id, editTitleValue.trim());
                          setEditingTitleId(null);
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        padding: '2px 6px',
                        border: '1px solid var(--accent)',
                        borderRadius: 4,
                        fontSize: 13,
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.title}
                    </span>
                  )}
                  {isActive && <span className="badge-active">Actif</span>}
                </div>
              );
            })}
          </div>

          {!showNewForm ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowNewForm(true)}
              style={{ width: '100%', marginTop: 8 }}
            >
              <IconPlus size={14} strokeWidth={2.2} />
              <span>Nouveau manuscrit</span>
            </button>
          ) : (
            <div style={{ marginTop: 8, padding: 8, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <input
                type="text"
                placeholder="Titre du manuscrit…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewForm(false)}>
                  Annuler
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                  {creating ? 'Création…' : 'Créer'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconPalette size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              Thème
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'day', label: 'Jour', Icon: IconSun },
              { id: 'sepia', label: 'Sépia', Icon: IconCompass },
              { id: 'night', label: 'Nuit', Icon: IconMoon },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id as 'day' | 'sepia' | 'night')}
                className={`pill ${theme === id ? 'active' : ''}`}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <Icon size={13} strokeWidth={2} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RGPD & Data Rights */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <IconShield size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-soft)' }}>
              Données & RGPD
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const exportData = {
                email: user?.email,
                penName,
                manuscripts,
                exportedAt: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `mes-manuscrits-atelier-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <IconDownload size={14} strokeWidth={2} />
            <span>Exporter mes données (JSON)</span>
          </button>
        </div>

        {/* Logout & Deletion */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              logOut();
              onClose();
            }}
            style={{ width: '100%' }}
          >
            Se déconnecter
          </button>
          <button
            onClick={async () => {
              if (
                window.confirm(
                  'Êtes-vous certain de vouloir supprimer définitivement votre compte et TOUS vos manuscrits ? Cette action est irréversible.'
                )
              ) {
                for (const m of manuscripts) {
                  await deleteManuscript(m.id);
                }
                await logOut();
                onClose();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--japandi-terracotta)',
              fontSize: 11.5,
              cursor: 'pointer',
              textDecoration: 'underline',
              textAlign: 'center',
              padding: 4,
            }}
          >
            Supprimer définitivement mon compte (Droit à l&apos;effacement)
          </button>
        </div>
      </div>
    </div>
  );
}
