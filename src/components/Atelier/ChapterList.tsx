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
  const { manuscript, manuscripts, selectManuscript, renameManuscript } = useAuth();
  const [isEditingManuscriptTitle, setIsEditingManuscriptTitle] = useState(false);
  const [manuscriptTitleValue, setManuscriptTitleValue] = useState('');

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
      <div className="chapter-list-header">
        <div className="chapter-list-title-group">
          <h3 className="sidebar-section-title">📚 Chapitres</h3>
          <span className="chapter-count-badge">{chapters.length}</span>
        </div>
        {onCloseSidebar && (
          <button 
            className="sidebar-close-btn" 
            onClick={onCloseSidebar}
            title="Fermer le menu"
          >
            ✕
          </button>
        )}
      </div>

      {/* Manuscript Switcher Bar */}
      {manuscript && (
        <div style={{ marginBottom: 14, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-soft)', fontFamily: 'var(--font-sans)' }}>
              MANUSCRIT ACTIF
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isEditingManuscriptTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <input
                  type="text"
                  value={manuscriptTitleValue}
                  onChange={(e) => setManuscriptTitleValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveManuscriptTitle()}
                  placeholder="Titre du manuscrit..."
                  style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
                />
                <button onClick={handleSaveManuscriptTitle} title="Valider" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                <button onClick={() => setIsEditingManuscriptTitle(false)} title="Annuler" style={{ background: 'var(--surface-2)', color: 'var(--text)', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <>
                <select
                  value={manuscript.id}
                  onChange={(e) => {
                    const target = manuscripts.find((m) => m.id === e.target.value);
                    if (target) selectManuscript(target);
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}
                >
                  {manuscripts.map((m) => (
                    <option key={m.id} value={m.id}>
                      📖 {m.title}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setManuscriptTitleValue(manuscript.title);
                    setIsEditingManuscriptTitle(true);
                  }}
                  title="Renommer ce manuscrit"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, padding: '6px 8px' }}
                >
                  ✏️
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
