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
import type { EditableChapter, ManuscriptAction } from '@/types/editor';

interface ChapterListProps {
  chapters: EditableChapter[];
  activeIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
}

export default function ChapterList({ chapters, activeIndex, dispatch }: ChapterListProps) {
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (index: number) => {
      dispatch({ type: 'SET_ACTIVE_CHAPTER', index });
    },
    [dispatch]
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
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            margin: 0,
          }}
        >
          Chapitres
        </h3>
        <button
          className="btn-icon"
          onClick={handleAdd}
          style={{ width: 28, height: 28, fontSize: 14 }}
          title="Ajouter un chapitre"
        >
          ＋
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
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="number">{chapterNumber(ch.title)}</span>
                <span className="title">{shortTitle(ch.title)}</span>
                <span className="word-count">
                  {ch.blocks.reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0)} m
                </span>
              </>
            )}

            {/* Delete button */}
            {confirmDeleteIndex === i ? (
              <div className="chapter-delete-confirm" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setConfirmDeleteIndex(null)}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                >
                  Non
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDelete(i)}
                  style={{ fontSize: 10, padding: '2px 8px', background: '#c0392b' }}
                >
                  Supprimer
                </button>
              </div>
            ) : (
              chapters.length > 1 && (
                <button
                  className="chapter-delete-btn"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteIndex(i); }}
                  title="Supprimer"
                >
                  ✕
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
