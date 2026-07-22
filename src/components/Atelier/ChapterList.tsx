/**
 * ChapterList — Interactive chapter sidebar
 *
 * Features:
 * - Create new chapters
 * - Rename chapters (double-click)
 * - Delete chapters (with confirmation)
 * - Drag & drop reorder
 * - Active chapter highlight
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import type { EditableChapter, ManuscriptAction } from '@/types/editor';

interface ChapterListProps {
  chapters: EditableChapter[];
  activeIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  onCloseSidebar?: () => void;
}

export default function ChapterList({ chapters, activeIndex, dispatch, onCloseSidebar }: ChapterListProps) {
  const { manuscript, manuscripts, selectManuscript, addManuscript, renameManuscript } = useAuth();
  const [isEditingManuscriptTitle, setIsEditingManuscriptTitle] = useState(false);
  const [manuscriptTitleValue, setManuscriptTitleValue] = useState('');
  const [showManuscriptsList, setShowManuscriptsList] = useState(false);
  const [showCreateManuscript, setShowCreateManuscript] = useState(false);
  const [newManuscriptTitle, setNewManuscriptTitle] = useState('');

  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSaveManuscriptTitle = async () => {
    if (manuscript && manuscriptTitleValue.trim()) {
      await renameManuscript(manuscript.id, manuscriptTitleValue.trim());
    }
    setIsEditingManuscriptTitle(false);
  };

  const handleCreateManuscript = async () => {
    if (newManuscriptTitle.trim()) {
      await addManuscript(newManuscriptTitle.trim());
      setNewManuscriptTitle('');
      setShowCreateManuscript(false);
      setShowManuscriptsList(false);
    }
  };

  const handleSelect = useCallback(
    (index: number) => {
      dispatch({ type: 'SET_ACTIVE_CHAPTER', index });
      if (onCloseSidebar) {
        onCloseSidebar();
      }
    },
    [dispatch, onCloseSidebar]
  );

  const handleStartRename = useCallback((index: number, currentTitle: string) => {
    setRenamingIndex(index);
    setRenameValue(currentTitle);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (renamingIndex !== null && renameValue.trim()) {
      dispatch({ type: 'RENAME_CHAPTER', chapterIndex: renamingIndex, title: renameValue.trim() });
    }
    setRenamingIndex(null);
  }, [renamingIndex, renameValue, dispatch]);

  const handleAdd = useCallback(() => {
    const num = chapters.length + 1;
    dispatch({ type: 'ADD_CHAPTER', title: `Chapitre ${num} — Nouveau chapitre` });
  }, [chapters.length, dispatch]);

  const handleDelete = useCallback(
    (index: number) => {
      dispatch({ type: 'DELETE_CHAPTER', chapterIndex: index });
      setConfirmDeleteIndex(null);
    },
    [dispatch]
  );

  const handleDragEnd = useCallback(() => {
    if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
      dispatch({ type: 'MOVE_CHAPTER', fromIndex: dragFromIndex, toIndex: dragOverIndex });
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, [dragFromIndex, dragOverIndex, dispatch]);

  // Extract short title from chapter title
  const shortTitle = (title: string) => {
    const parts = title.split('—');
    return parts.length > 1 ? parts[1].trim() : title;
  };

  const chapterNumber = (title: string) => {
    const match = title.match(/chapitre\s*(\d+)/i);
    return match ? `Ch. ${match[1]}` : '';
  };

  return (
    <div className="chapter-list">
      {/* Top Section: Manuscripts Header & Switcher */}
      <div className="manuscript-section-container" style={{ borderBottom: '1px solid var(--border)', marginBottom: 12, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 6px' }}>
          <button
            onClick={() => setShowManuscriptsList(!showManuscriptsList)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}
            title="Changer de manuscrit"
          >
            <span style={{ fontSize: 12, opacity: 0.7 }}>{showManuscriptsList ? '▼' : '▶'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-soft)', fontFamily: 'var(--font-sans)' }}>
              MES MANUSCRITS ({manuscripts.length})
            </span>
          </button>
          
          {onCloseSidebar && (
            <button className="sidebar-close-btn" onClick={onCloseSidebar} title="Fermer le menu">
              ✕
            </button>
          )}
        </div>

        {/* Current Active Manuscript Row */}
        {manuscript && (
          <div style={{ background: 'rgba(138,90,52,0.06)', borderRadius: 10, padding: '8px 10px', marginTop: 4, border: '1px solid rgba(138,90,52,0.15)' }}>
            {isEditingManuscriptTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  value={manuscriptTitleValue}
                  onChange={(e) => setManuscriptTitleValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveManuscriptTitle()}
                  placeholder="Titre du manuscrit..."
                  style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
                />
                <button onClick={handleSaveManuscriptTitle} title="Valider" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>✓</button>
                <button onClick={() => setIsEditingManuscriptTitle(false)} title="Annuler" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div 
                  onClick={() => setShowManuscriptsList(!showManuscriptsList)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', cursor: 'pointer', flex: 1 }}
                  title="Cliquer pour dérouler la liste des manuscrits"
                >
                  <span style={{ fontSize: 14 }}>📖</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-sans)' }}>
                    {manuscript.title}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setManuscriptTitleValue(manuscript.title);
                    setIsEditingManuscriptTitle(true);
                  }}
                  title="Renommer ce manuscrit"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, opacity: 0.7, padding: '2px 4px' }}
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Dropdown List of Manuscripts */}
        {showManuscriptsList && (
          <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            {manuscripts.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  selectManuscript(m);
                  setShowManuscriptsList(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', margin: '2px 0',
                  background: m.id === manuscript?.id ? 'rgba(138,90,52,0.12)' : 'transparent',
                  fontWeight: m.id === manuscript?.id ? 700 : 500,
                  color: 'var(--text)', fontSize: 13
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📖 {m.title}
                </span>
                {m.id === manuscript?.id && <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>✔ actif</span>}
              </div>
            ))}

            {/* Create New Manuscript Button */}
            {showCreateManuscript ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 4px' }}>
                <input
                  type="text"
                  value={newManuscriptTitle}
                  onChange={(e) => setNewManuscriptTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateManuscript()}
                  placeholder="Nom du nouveau livre..."
                  style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12.5, color: 'var(--text)', outline: 'none' }}
                />
                <button onClick={handleCreateManuscript} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Créer</button>
                <button onClick={() => setShowCreateManuscript(false)} style={{ background: 'transparent', color: 'var(--text)', border: 'none', padding: '4px', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateManuscript(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                  marginTop: 6, padding: '8px 10px', borderRadius: 6,
                  border: '1px dashed var(--border)', background: 'transparent',
                  color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <span>＋</span> Nouveau manuscrit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="chapter-list-header">
        <div className="chapter-list-title-group">
          <h3 className="sidebar-section-title">📚 Chapitres</h3>
          <span className="chapter-count-badge">{chapters.length}</span>
        </div>
      </div>

      <div className="chapter-list-add-area">
        <button
          className="btn-add-chapter"
          onClick={handleAdd}
          title="Ajouter un nouveau chapitre"
        >
          <span className="add-icon">＋</span>
          <span>Nouveau chapitre</span>
        </button>
      </div>

      <div className="chapter-items">
        {chapters.map((ch, i) => (
          <div
            key={ch.id}
            className={`chapter-list-item ${i === activeIndex ? 'active' : ''} ${dragOverIndex === i ? 'drag-over' : ''}`}
            draggable={renamingIndex !== i}
            onClick={() => renamingIndex !== i && handleSelect(i)}
            onDoubleClick={() => handleStartRename(i, ch.title)}
            onDragStart={() => setDragFromIndex(i)}
            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
            onDragEnd={handleDragEnd}
          >
            {renamingIndex === i ? (
              <div className="chapter-rename-box" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  className="chapter-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename();
                    if (e.key === 'Escape') setRenamingIndex(null);
                  }}
                  autoFocus
                />
                <button className="btn-confirm-rename" onClick={handleFinishRename} title="Valider">
                  ✓
                </button>
              </div>
            ) : (
              <>
                <div className="chapter-info">
                  <div className="chapter-title-row">
                    <span className="chapter-number">{chapterNumber(ch.title) || `Ch. ${i + 1}`}</span>
                    <span className="chapter-title-text" title="Double-cliquez pour renommer">
                      {shortTitle(ch.title)}
                    </span>
                  </div>
                  <span className="chapter-meta">
                    {ch.blocks.reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0)} mots
                  </span>
                </div>

                {/* Visible Actions: Edit & Delete */}
                <div className="chapter-item-actions" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteIndex === i ? (
                    <div className="chapter-delete-confirm">
                      <button
                        className="btn-confirm-no"
                        onClick={() => setConfirmDeleteIndex(null)}
                      >
                        Non
                      </button>
                      <button
                        className="btn-confirm-yes"
                        onClick={() => handleDelete(i)}
                      >
                        Oui
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="chapter-action-btn chapter-edit-btn"
                        onClick={() => handleStartRename(i, ch.title)}
                        title="Renommer le chapitre"
                      >
                        ✏️
                      </button>
                      {chapters.length > 1 && (
                        <button
                          className="chapter-action-btn chapter-delete-btn"
                          onClick={() => setConfirmDeleteIndex(i)}
                          title="Supprimer le chapitre"
                        >
                          🗑️
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
