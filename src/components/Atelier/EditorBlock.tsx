/**
 * EditorBlock — Individual editable paragraph block
 *
 * Features:
 * - contentEditable for inline editing
 * - Drag handle for reordering
 * - Delete button on hover
 * - Insert button between blocks
 * - Enter splits, Backspace at start merges
 * - Visual indicator for insertion point
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { TextBlock } from '@/types/editor';

interface EditorBlockProps {
  block: TextBlock;
  index: number;
  isInsertionPoint: boolean;
  isFocused: boolean;
  isDimmed?: boolean;
  searchQuery?: string;
  onUpdate: (blockId: string, content: string) => void;
  onDelete: (blockId: string) => void;
  onSplit: (blockId: string, splitAt: number) => void;
  onMergeWithPrevious: (blockId: string) => void;
  onInsertAfter: (blockId: string) => void;
  onSetInsertionPoint: (index: number | null) => void;
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
  onUpdate,
  onDelete,
  onSplit,
  onMergeWithPrevious,
  onInsertAfter,
  onSetInsertionPoint,
  onFocus,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
  totalBlocks,
  isDimmed = false,
  searchQuery = '',
}: EditorBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const lastContentRef = useRef(block.content);

  // Sync content from outside only when block.content changes externally
  useEffect(() => {
    if (ref.current && block.content !== lastContentRef.current && document.activeElement !== ref.current) {
      ref.current.textContent = block.content;
      lastContentRef.current = block.content;
    }
  }, [block.content]);

  // Set initial content
  useEffect(() => {
    if (ref.current && ref.current.textContent !== block.content) {
      ref.current.textContent = block.content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const content = ref.current.textContent || '';
    lastContentRef.current = content;
    onUpdate(block.id, content);
  }, [block.id, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || !ref.current) return;
        
        // Get cursor offset in text
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(ref.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        const splitAt = preRange.toString().length;
        
        onSplit(block.id, splitAt);
      }

      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (!sel || !ref.current) return;
        
        // Check if cursor is at the very start
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(ref.current);
        preRange.setEnd(range.startContainer, range.startOffset);
        
        if (preRange.toString().length === 0 && index > 0) {
          e.preventDefault();
          onMergeWithPrevious(block.id);
        }
      }
    },
    [block.id, index, onSplit, onMergeWithPrevious]
  );

  const handleFocus = useCallback(() => {
    onFocus(block.id);
  }, [block.id, onFocus]);

  const handleInsertionClick = useCallback(() => {
    onSetInsertionPoint(isInsertionPoint ? null : index);
  }, [index, isInsertionPoint, onSetInsertionPoint]);

  const sourceIndicator = block.source === 'dictation' ? '🎙️' : block.source === 'original' ? '' : '';
  const hasSearchMatch = searchQuery && block.content.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <>
      {/* Insertion point indicator (before block) */}
      {index === 0 && (
        <div
          className={`editor-insert-line ${isInsertionPoint && index === 0 ? 'active' : ''}`}
          onClick={() => onSetInsertionPoint(isInsertionPoint ? null : -1)}
          title="Insérer la dictée ici"
        >
          <span className="editor-insert-line-btn">＋</span>
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
          ⠿
        </div>

        {/* Source badge */}
        {sourceIndicator && (
          <span className="editor-block-source">{sourceIndicator}</span>
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
          data-placeholder="Commencez à écrire..."
          spellCheck
          lang="fr"
        />

        {/* Actions (visible on hover) */}
        {isHovered && (
          <div className="editor-block-actions">
            {totalBlocks > 1 && (
              <button
                className="editor-block-action-btn delete"
                onClick={() => onDelete(block.id)}
                title="Supprimer ce bloc"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Insert line between blocks */}
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
          title="Insérer un paragraphe"
        >
          ＋
        </button>
        <button
          className={`editor-insert-line-btn dictation ${isInsertionPoint ? 'active' : ''}`}
          onClick={handleInsertionClick}
          title={isInsertionPoint ? 'Annuler le point d\'insertion' : 'La dictée s\'insérera ici'}
        >
          🎙️
        </button>
      </div>
    </>
  );
}
