/**
 * ChapterList — Interactive chapter & manuscript sidebar
 *
 * Implements the exact user design refonte from apercu-refonte-chapitres.html
 * - Manuscript Cards with Chevron collapse/expand
 * - Active Manuscript Badge
 * - Manuscript Kebab Menu (Renommer, Supprimer)
 * - Chapter Rows with Drag handle, Ch. Badge, Title, Word count, Kebab Menu
 * - Nouveau chapitre button per manuscript
 * - Nouveau manuscrit button at bottom
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import type { EditableChapter, ManuscriptAction } from '@/types/editor';

interface ChapterListProps {
  chapters: EditableChapter[];
  activeIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  onCloseSidebar?: () => void;
}

export default function ChapterList({ chapters, activeIndex, dispatch, onCloseSidebar }: ChapterListProps) {
  const { manuscript, manuscripts, selectManuscript, createManuscript, renameManuscript, deleteManuscript } = useAuth();

  // Expanded manuscript accordion state (defaults to active manuscript ID)
  const [openManuscriptIds, setOpenManuscriptIds] = useState<string[]>(() => (manuscript?.id ? [manuscript.id] : []));

  // Sync open manuscript when active manuscript changes if not already open
  useEffect(() => {
    if (manuscript?.id) {
      setOpenManuscriptIds((prev) => (prev.includes(manuscript.id) ? prev : [...prev, manuscript.id]));
    }
  }, [manuscript?.id]);

  // Manuscript Kebab & Rename state
  const [msMenuId, setMsMenuId] = useState<string | null>(null);
  const [renamingMsId, setRenamingMsId] = useState<string | null>(null);
  const [renamingMsTitle, setRenamingMsTitle] = useState('');
  const [confirmDeleteMsId, setConfirmDeleteMsId] = useState<string | null>(null);

  // New Manuscript creation input state
  const [isCreatingManuscript, setIsCreatingManuscript] = useState(false);
  const [newManuscriptTitle, setNewManuscriptTitle] = useState('');

  // Chapter Kebab, Rename & Delete state
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  // Drag & drop state
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const msMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuIndex(null);
        setConfirmDeleteIndex(null);
      }
      if (msMenuRef.current && !msMenuRef.current.contains(e.target as Node)) {
        setMsMenuId(null);
        setConfirmDeleteMsId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Manuscript Handlers ──
  const toggleManuscriptCard = (id: string) => {
    const target = manuscripts.find((m) => m.id === id);
    if (target && target.id !== manuscript?.id) {
      selectManuscript(target);
    }
    setOpenManuscriptIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleStartRenameManuscript = (id: string, currentTitle: string) => {
    setRenamingMsId(id);
    setRenamingMsTitle(currentTitle);
    setMsMenuId(null);
  };

  const handleSaveRenameManuscript = async (id: string) => {
    if (renamingMsTitle.trim()) {
      await renameManuscript(id, renamingMsTitle.trim());
    }
    setRenamingMsId(null);
  };

  const handleDeleteManuscript = async (id: string) => {
    await deleteManuscript(id);
    setConfirmDeleteMsId(null);
    setMsMenuId(null);
  };

  const handleCreateNewManuscript = async () => {
    if (newManuscriptTitle.trim()) {
      await createManuscript(newManuscriptTitle.trim());
      setNewManuscriptTitle('');
      setIsCreatingManuscript(false);
    }
  };

  // ── Chapter Handlers ──
  const handleSelectChapter = useCallback(
    (index: number) => {
      dispatch({ type: 'SET_ACTIVE_CHAPTER', index });
      if (onCloseSidebar) {
        onCloseSidebar();
      }
    },
    [dispatch, onCloseSidebar]
  );

  const handleStartRenameChapter = useCallback((index: number, currentTitle: string) => {
    setRenamingIndex(index);
    setRenameValue(currentTitle);
    setMenuIndex(null);
    setConfirmDeleteIndex(null);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const handleFinishRenameChapter = useCallback(() => {
    if (renamingIndex !== null && renameValue.trim()) {
      dispatch({ type: 'RENAME_CHAPTER', chapterIndex: renamingIndex, title: renameValue.trim() });
    }
    setRenamingIndex(null);
  }, [renamingIndex, renameValue, dispatch]);

  const handleAddChapter = useCallback(() => {
    const num = chapters.length + 1;
    dispatch({ type: 'ADD_CHAPTER', title: `Chapitre ${num} — Nouveau chapitre` });
  }, [chapters.length, dispatch]);

  const handleDeleteChapter = useCallback(
    (index: number) => {
      dispatch({ type: 'DELETE_CHAPTER', chapterIndex: index });
      setConfirmDeleteIndex(null);
      setMenuIndex(null);
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

  const shortTitle = (title: string) => {
    const parts = title.split('—');
    return parts.length > 1 ? parts[1].trim() : title;
  };

  const chapterNumberStr = (title: string, index: number) => {
    const match = title.match(/chapitre\s*(\d+)/i);
    return match ? `Ch. ${match[1]}` : `Ch. ${index + 1}`;
  };

  const chapterWordCount = (ch: EditableChapter) =>
    ch.blocks.reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0);

  const totalWords = chapters.reduce((sum, ch) => sum + chapterWordCount(ch), 0);

  return (
    <div className="chapter-list">
      {/* Header */}
      <div className="chapter-list-header">
        <div className="chapter-list-title-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 className="sidebar-section-title" style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700 }}>
            📚 Mes manuscrits
          </h3>
          <span className="chapter-count-badge">{manuscripts.length}</span>
        </div>
        {onCloseSidebar && (
          <button className="sidebar-close-btn" onClick={onCloseSidebar} title="Fermer le menu">
            ✕
          </button>
        )}
      </div>

      {/* Manuscripts List */}
      <div className="manuscripts-container" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {manuscripts.map((m) => {
          const isActive = m.id === manuscript?.id;
          const isOpen = openManuscriptIds.includes(m.id);

          return (
            <div key={m.id} className={`manuscript-card ${isOpen ? 'open' : ''}`}>
              {/* Manuscript Header */}
              <div className="manuscript-header" onClick={() => toggleManuscriptCard(m.id)}>
                <span className="chevron" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  ›
                </span>
                <span className="ms-icon">📖</span>

                {renamingMsId === m.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renamingMsTitle}
                      onChange={(e) => setRenamingMsTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameManuscript(m.id)}
                      style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 6px', fontSize: 13, fontWeight: 600 }}
                    />
                    <button onClick={() => handleSaveRenameManuscript(m.id)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                  </div>
                ) : (
                  <span className="ms-title">{m.title}</span>
                )}

                {isActive && <span className="badge-active">Actif</span>}

                <div className="kebab-wrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="kebab-btn"
                    onClick={() => {
                      setMsMenuId(msMenuId === m.id ? null : m.id);
                      setConfirmDeleteMsId(null);
                    }}
                    title="Actions manuscrit"
                  >
                    ⋮
                  </button>

                  {msMenuId === m.id && (
                    <div className="kebab-menu show" ref={msMenuRef}>
                      {confirmDeleteMsId === m.id ? (
                        <>
                          <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600 }}>Supprimer ce manuscrit ?</div>
                          <div className="confirm-row">
                            <button onClick={() => setConfirmDeleteMsId(null)}>Non</button>
                            <button className="danger" onClick={() => handleDeleteManuscript(m.id)}>Oui</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleStartRenameManuscript(m.id, m.title)}>Renommer</button>
                          {manuscripts.length > 1 && (
                            <button className="danger" onClick={() => setConfirmDeleteMsId(m.id)}>Supprimer</button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Manuscript Chapters Body */}
              {isOpen && (
                <div className="manuscript-body">
                  {isActive && (
                    <>
                      <div className="manuscript-meta">
                        <span>{chapters.length} chapitre{chapters.length > 1 ? 's' : ''}</span>
                        <span>{totalWords} mots</span>
                      </div>

                      <div className="add-chapter-area">
                        <button className="btn-add-chapter" onClick={handleAddChapter}>
                          ＋ Nouveau chapitre
                        </button>
                      </div>

                      <div className="chapter-rows">
                        {chapters.map((ch, i) => {
                          const isChActive = i === activeIndex;

                          return (
                            <div
                              key={ch.id}
                              className={`chapter-row ${isChActive ? 'active' : ''}`}
                              draggable={renamingIndex !== i}
                              onClick={() => renamingIndex !== i && handleSelectChapter(i)}
                              onDoubleClick={() => handleStartRenameChapter(i, ch.title)}
                              onDragStart={() => setDragFromIndex(i)}
                              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                              onDragEnd={handleDragEnd}
                            >
                              {renamingIndex === i ? (
                                <div className="chapter-rename-box" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, flex: 1 }}>
                                  <input
                                    ref={inputRef}
                                    className="chapter-rename-input"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleFinishRenameChapter}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleFinishRenameChapter();
                                      if (e.key === 'Escape') setRenamingIndex(null);
                                    }}
                                    autoFocus
                                    style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, padding: '3px 6px', fontSize: 13 }}
                                  />
                                  <button className="btn-confirm-rename" onClick={handleFinishRenameChapter} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px' }}>✓</button>
                                </div>
                              ) : (
                                <>
                                  <span className="drag-handle" title="Glisser pour réordonner">⠿</span>
                                  <span className="ch-badge">{chapterNumberStr(ch.title, i)}</span>
                                  <div className="ch-info">
                                    <span className="ch-title" title={ch.title}>
                                      {shortTitle(ch.title)}
                                    </span>
                                    <span className="ch-words">{chapterWordCount(ch)} mots</span>
                                  </div>

                                  <div className="kebab-wrap" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="kebab-btn"
                                      aria-label="Actions du chapitre"
                                      onClick={() => {
                                        setMenuIndex(menuIndex === i ? null : i);
                                        setConfirmDeleteIndex(null);
                                      }}
                                      title="Actions chapitre"
                                    >
                                      ⋮
                                    </button>

                                    {menuIndex === i && (
                                      <div className="kebab-menu show" ref={menuRef}>
                                        {confirmDeleteIndex === i ? (
                                          <>
                                            <div style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600 }}>Supprimer ?</div>
                                            <div className="confirm-row">
                                              <button onClick={() => setConfirmDeleteIndex(null)}>Non</button>
                                              <button className="danger" onClick={() => handleDeleteChapter(i)}>Oui</button>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <button onClick={() => handleStartRenameChapter(i, ch.title)}>Renommer</button>
                                            {chapters.length > 1 && (
                                              <button className="danger" onClick={() => setConfirmDeleteIndex(i)}>Supprimer</button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Button to Create a New Manuscript */}
      <div style={{ marginTop: 14 }}>
        {isCreatingManuscript ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              value={newManuscriptTitle}
              onChange={(e) => setNewManuscriptTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNewManuscript()}
              placeholder="Titre du nouveau manuscrit..."
              style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
            />
            <button onClick={handleCreateNewManuscript} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Créer</button>
            <button onClick={() => setIsCreatingManuscript(false)} style={{ background: 'transparent', color: 'var(--text)', border: 'none', padding: '6px', fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <button className="btn-new-manuscript" onClick={() => setIsCreatingManuscript(true)}>
            ＋ Nouveau manuscrit
          </button>
        )}
      </div>
    </div>
  );
}
