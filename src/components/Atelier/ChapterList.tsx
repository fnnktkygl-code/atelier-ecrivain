/**
 * ChapterList — Tiroir interactif des manuscrits et chapitres (Japandi Minimaliste)
 *
 * Fonctionnalités :
 * - Cartes de manuscrits accordéon avec chevrons SVG fluides
 * - Badge de manuscrit actif
 * - Menu d'actions (Renommer, Supprimer avec dialogue sécurisé)
 * - Lignes de chapitre avec drag handle (desktop) et boutons de réordonnancement tactile 1-tap (mobile)
 * - Création rapide de nouveau chapitre & nouveau manuscrit
 * - Accès direct au Studio Couverture & Export PDF
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import type { EditableChapter, ManuscriptAction } from '@/types/editor';
import {
  IconBook,
  IconPlus,
  IconMoreVertical,
  IconCheck,
  IconClose,
  IconDragHandle,
  IconArrowUp,
  IconArrowDown,
  IconPalette,
  IconChevronRight,
  IconFolder,
  IconEdit,
  IconTrash,
} from '@/components/Shared/Icons';

interface ChapterListProps {
  chapters: EditableChapter[];
  activeIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  onCloseSidebar?: () => void;
  onOpenPdfExport?: () => void;
}

export default function ChapterList({
  chapters,
  activeIndex,
  dispatch,
  onCloseSidebar,
  onOpenPdfExport,
}: ChapterListProps) {
  const {
    manuscript,
    manuscripts,
    selectManuscript,
    createManuscript,
    renameManuscript,
    deleteManuscript,
  } = useAuth();

  // Expanded manuscript accordion state
  const [openManuscriptIds, setOpenManuscriptIds] = useState<string[]>(() =>
    manuscript?.id ? [manuscript.id] : []
  );

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

  const handleMoveChapter = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= chapters.length || fromIndex === toIndex) return;
      dispatch({ type: 'MOVE_CHAPTER', fromIndex, toIndex });
    },
    [chapters.length, dispatch]
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
        <div className="chapter-list-title-group">
          <IconFolder size={17} strokeWidth={2} className="sidebar-section-icon" />
          <h3 className="sidebar-section-title">Mes manuscrits</h3>
          <span className="chapter-count-badge">{manuscripts.length}</span>
        </div>
        {onCloseSidebar && (
          <button className="sidebar-close-btn" onClick={onCloseSidebar} title="Fermer le panneau" aria-label="Fermer">
            <IconClose size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Manuscripts List */}
      <div className="manuscripts-container">
        {manuscripts.map((m) => {
          const isActive = m.id === manuscript?.id;
          const isOpen = openManuscriptIds.includes(m.id);

          return (
            <div key={m.id} className={`manuscript-card ${isOpen ? 'open' : ''}`}>
              {/* Manuscript Header */}
              <div className="manuscript-header" onClick={() => toggleManuscriptCard(m.id)}>
                <span className={`chevron ${isOpen ? 'open' : ''}`}>
                  <IconChevronRight size={14} strokeWidth={2} />
                </span>
                <span className="ms-icon">
                  <IconBook size={15} strokeWidth={1.8} />
                </span>

                {renamingMsId === m.id ? (
                  <div className="ms-rename-inline" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={renamingMsTitle}
                      onChange={(e) => setRenamingMsTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameManuscript(m.id)}
                      className="ms-rename-input"
                    />
                    <button
                      onClick={() => handleSaveRenameManuscript(m.id)}
                      className="btn-confirm-mini"
                      title="Enregistrer"
                    >
                      <IconCheck size={13} strokeWidth={2.5} />
                    </button>
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
                    aria-label="Actions du manuscrit"
                  >
                    <IconMoreVertical size={16} strokeWidth={2} />
                  </button>

                  {msMenuId === m.id && (
                    <div className="kebab-menu show" ref={msMenuRef}>
                      {confirmDeleteMsId === m.id ? (
                        <div className="confirm-delete-box">
                          <span className="confirm-delete-text">Supprimer ce manuscrit ?</span>
                          <div className="confirm-row">
                            <button onClick={() => setConfirmDeleteMsId(null)}>Annuler</button>
                            <button className="danger" onClick={() => handleDeleteManuscript(m.id)}>
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => handleStartRenameManuscript(m.id, m.title)}>
                            <IconEdit size={14} />
                            <span>Renommer</span>
                          </button>
                          {manuscripts.length > 1 && (
                            <button className="danger" onClick={() => setConfirmDeleteMsId(m.id)}>
                              <IconTrash size={14} />
                              <span>Supprimer</span>
                            </button>
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
                        <span>{totalWords.toLocaleString('fr-FR')} mots</span>
                      </div>

                      <div className="add-chapter-area">
                        <button className="btn-add-chapter" onClick={handleAddChapter}>
                          <IconPlus size={15} strokeWidth={2.2} />
                          <span>Nouveau chapitre</span>
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
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverIndex(i);
                              }}
                              onDragEnd={handleDragEnd}
                            >
                              {renamingIndex === i ? (
                                <div className="chapter-rename-box" onClick={(e) => e.stopPropagation()}>
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
                                  />
                                  <button
                                    className="btn-confirm-rename"
                                    onClick={handleFinishRenameChapter}
                                    title="Valider"
                                  >
                                    <IconCheck size={15} strokeWidth={2.5} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="drag-handle" title="Glisser pour réordonner">
                                    <IconDragHandle size={14} />
                                  </span>

                                  {/* Quick touch reordering buttons for mobile */}
                                  <div className="touch-reorder-group" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="btn-touch-reorder"
                                      disabled={i === 0}
                                      onClick={() => handleMoveChapter(i, i - 1)}
                                      title="Monter le chapitre"
                                      aria-label="Monter le chapitre"
                                    >
                                      <IconArrowUp size={12} strokeWidth={2.2} />
                                    </button>
                                    <button
                                      className="btn-touch-reorder"
                                      disabled={i === chapters.length - 1}
                                      onClick={() => handleMoveChapter(i, i + 1)}
                                      title="Descendre le chapitre"
                                      aria-label="Descendre le chapitre"
                                    >
                                      <IconArrowDown size={12} strokeWidth={2.2} />
                                    </button>
                                  </div>

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
                                      <IconMoreVertical size={15} strokeWidth={2} />
                                    </button>

                                    {menuIndex === i && (
                                      <div className="kebab-menu show" ref={menuRef}>
                                        {confirmDeleteIndex === i ? (
                                          <div className="confirm-delete-box">
                                            <span className="confirm-delete-text">Supprimer ce chapitre ?</span>
                                            <div className="confirm-row">
                                              <button onClick={() => setConfirmDeleteIndex(null)}>Non</button>
                                              <button className="danger" onClick={() => handleDeleteChapter(i)}>
                                                Oui
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <button onClick={() => handleStartRenameChapter(i, ch.title)}>
                                              <IconEdit size={14} />
                                              <span>Renommer</span>
                                            </button>
                                            {chapters.length > 1 && (
                                              <button className="danger" onClick={() => setConfirmDeleteIndex(i)}>
                                                <IconTrash size={14} />
                                                <span>Supprimer</span>
                                              </button>
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
      <div className="new-manuscript-area">
        {isCreatingManuscript ? (
          <div className="new-manuscript-form">
            <input
              type="text"
              value={newManuscriptTitle}
              onChange={(e) => setNewManuscriptTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNewManuscript()}
              placeholder="Titre du nouveau manuscrit…"
              className="new-manuscript-input"
            />
            <div className="new-manuscript-actions">
              <button onClick={handleCreateNewManuscript} className="btn-create-ms">
                Créer
              </button>
              <button onClick={() => setIsCreatingManuscript(false)} className="btn-cancel-ms" title="Annuler">
                <IconClose size={15} />
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-new-manuscript" onClick={() => setIsCreatingManuscript(true)}>
            <IconPlus size={15} strokeWidth={2.2} />
            <span>Nouveau manuscrit</span>
          </button>
        )}

        {/* Button to Open PDF & Cover Studio */}
        {onOpenPdfExport && (
          <button className="btn-pdf-export-sidebar" onClick={onOpenPdfExport}>
            <IconPalette size={16} strokeWidth={1.8} />
            <span>Studio Couverture & Export PDF</span>
          </button>
        )}
      </div>
    </div>
  );
}
