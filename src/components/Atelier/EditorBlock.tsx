/**
 * EditorBlock — Bloc de paragraphe éditable individuel (Japandi Minimaliste)
 *
 * Supporte le contentEditable avec debounce, insertion de dictée,
 * séparation de paragraphe (Entrée) et fusion (Retour arrière).
 */

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { TextBlock } from '@/types/editor';
import { IconMic, IconPlus, IconClose, IconDragHandle } from '@/components/Shared/Icons';

interface EditorBlockProps {
  block: TextBlock;
  index: number;
  isInsertionPoint: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  searchQuery: string;
  onUpdate: (blockId: string, content: string) => void;
  onDelete: (blockId: string) => void;
  onSplit: (blockId: string, splitAt: number) => void;
  onMergeWithPrevious: (blockId: string) => void;
  onInsertAfter: (blockId: string) => void;
  onSetInsertionPoint: (blockIndex: number | null) => void;
  onStartDictation?: () => void;
  onFocus: (blockId: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  totalBlocks: number;
}

export default function EditorBlock({
  block,
  index,
  isInsertionPoint,
  isFocused,
  isDimmed,
  searchQuery,
  onUpdate,
  onDelete,
  onSplit,
  onMergeWithPrevious,
  onInsertAfter,
  onSetInsertionPoint,
  onStartDictation,
  onFocus,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
  totalBlocks,
}: EditorBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Sync DOM content when block.content changes externally (e.g., undo/redo)
  useEffect(() => {
    if (ref.current && ref.current.innerText !== block.content) {
      ref.current.innerText = block.content;
    }
  }, [block.content]);

  // Focus the element if isFocused is true
  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      const text = ref.current.innerText;
      onUpdate(block.id, text);
    }
  }, [block.id, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Enter -> Split block at cursor
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        const offset = sel ? sel.anchorOffset : block.content.length;
        onSplit(block.id, offset);
      }

      // Backspace at position 0 -> Merge with previous block
      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (sel && sel.anchorOffset === 0 && sel.isCollapsed && index > 0) {
          e.preventDefault();
          onMergeWithPrevious(block.id);
        }
      }
    },
    [block.id, block.content.length, index, onSplit, onMergeWithPrevious]
  );

  const handleFocus = useCallback(() => {
    onFocus(block.id);
  }, [block.id, onFocus]);

  const handleInsertionClick = useCallback(() => {
    onSetInsertionPoint(isInsertionPoint ? null : index);
    if (!isInsertionPoint && onStartDictation) {
      onStartDictation();
    }
  }, [isInsertionPoint, index, onSetInsertionPoint, onStartDictation]);

  const hasSearchMatch = searchQuery && block.content.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <>
      {/* Insertion point indicator (before first block) */}
      {index === 0 && (
        <div
          className={`editor-insert-line ${isInsertionPoint && index === 0 ? 'active' : ''}`}
          onClick={() => onSetInsertionPoint(isInsertionPoint ? null : -1)}
          title="Insérer la dictée ici"
        >
          <span className="editor-insert-line-btn">
            <IconPlus size={13} strokeWidth={2.5} />
          </span>
        </div>
      )}

      <div
        className={`editor-block ${isFocused ? 'focused' : ''} ${isDragOver ? 'drag-over' : ''} ${block.source === 'dictation' ? 'from-dictation' : ''} ${hasSearchMatch ? 'search-match' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={isDimmed ? { opacity: 0.25, transition: 'opacity .3s ease' } : { transition: 'opacity .3s ease' }}
      >
        {/* Drag handle */}
        <div
          className="editor-block-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            onDragStart(index);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOver(index);
          }}
          onDragEnd={onDragEnd}
          title="Glisser pour réorganiser"
        >
          <IconDragHandle size={14} />
        </div>

        {/* Source badge */}
        {block.source === 'dictation' && (
          <span className="editor-block-source">
            <IconMic size={12} strokeWidth={2} />
            <span>Dictée</span>
          </span>
        )}

        {/* Editable content */}
        <div
          ref={ref}
          className="editor-block-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          data-placeholder="Commencez à écrire…"
          spellCheck
          lang="fr"
        />

        {/* Actions (visible on hover or focus) */}
        {(isHovered || isFocused) && (
          <div className="editor-block-actions">
            {onStartDictation && (
              <button
                className="editor-block-action-btn dictation-block-btn"
                onClick={handleInsertionClick}
                title="Dicter après ce paragraphe"
              >
                <IconMic size={13} strokeWidth={2} />
                <span>Dicter</span>
              </button>
            )}
            {totalBlocks > 1 && (
              <button
                className="editor-block-action-btn delete"
                onClick={() => onDelete(block.id)}
                title="Supprimer ce bloc"
                aria-label="Supprimer ce paragraphe"
              >
                <IconClose size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Insert bar between blocks */}
      <div
        className={`editor-insert-line ${isInsertionPoint ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(index + 1);
        }}
      >
        <button
          className="editor-insert-line-btn"
          onClick={() => onInsertAfter(block.id)}
          title="Insérer un paragraphe vide"
        >
          <IconPlus size={13} strokeWidth={2.2} />
          <span>Paragraphe</span>
        </button>
        <button
          className={`editor-insert-line-btn dictation ${isInsertionPoint ? 'active' : ''}`}
          onClick={handleInsertionClick}
          title={isInsertionPoint ? "Annuler le point d'insertion" : 'Dicter à la suite de ce paragraphe'}
        >
          <IconMic size={13} strokeWidth={2} />
          <span>{isInsertionPoint ? "Point d'insertion actif" : 'Dicter ici'}</span>
        </button>
      </div>
    </>
  );
}
