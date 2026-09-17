/**
 * EditorBlock — Bloc de paragraphe éditable individuel (Japandi Minimaliste)
 *
 * Supporte le contentEditable avec debounce, insertion de dictée,
 * séparation de paragraphe (Entrée) et fusion (Retour arrière).
 */

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { TextBlock } from '@/types/editor';
import { IconMic, IconStop, IconPlus, IconClose, IconDragHandle, IconSparkles } from '@/components/Shared/Icons';

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
  onStartDictation?: (targetBlockId?: string) => void;
  onStopDictation?: () => void;
  isDictatingThisBlock?: boolean;
  dictationPhase?: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  interimText?: string;
  onAnalyzeBlock?: (blockId: string, content: string) => void;
  isAnalyzingBlock?: boolean;
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
  onStopDictation,
  isDictatingThisBlock = false,
  dictationPhase = 'idle',
  interimText = '',
  onAnalyzeBlock,
  isAnalyzingBlock = false,
  onFocus,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragOver,
  totalBlocks,
}: EditorBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Sync DOM content when block.content changes externally or while streaming dictation
  useEffect(() => {
    if (isDictatingThisBlock && ref.current) {
      const base = block.content ? block.content.trim() + ' ' : '';
      const textToShow = interimText ? base + interimText : block.content;

      if (ref.current.innerText !== textToShow) {
        ref.current.innerText = textToShow;
        // Position caret at the end of the text so author sees natural typing flow
        try {
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(ref.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch {}
      }
    } else if (!isDictatingThisBlock && ref.current && ref.current.innerHTML !== block.content) {
      ref.current.innerHTML = block.content;
    }
  }, [block.content, isDictatingThisBlock, interimText]);

  // Scroll into view & center smoothly when dictation begins
  useEffect(() => {
    if (isDictatingThisBlock && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try {
        ref.current.focus({ preventScroll: true });
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {}
    }
  }, [isDictatingThisBlock]);

  // Focus the element if isFocused is true
  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (ref.current && !isDictatingThisBlock) {
      const html = ref.current.innerHTML;
      onUpdate(block.id, html);
    }
  }, [block.id, onUpdate, isDictatingThisBlock]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isDictatingThisBlock) {
        if (e.key === 'Enter') e.preventDefault();
        return;
      }
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
    [block.id, block.content.length, index, onSplit, onMergeWithPrevious, isDictatingThisBlock]
  );

  const handleFocus = useCallback(() => {
    onFocus(block.id);
    if (typeof window !== 'undefined' && window.innerWidth <= 900 && ref.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 280);
    }
  }, [block.id, onFocus]);

  const handleDictateClick = useCallback(() => {
    if (isDictatingThisBlock) {
      onStopDictation?.();
    } else {
      onStartDictation?.(block.id);
    }
  }, [isDictatingThisBlock, onStopDictation, onStartDictation, block.id]);

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
        className={`editor-block ${isFocused ? 'focused' : ''} ${isDimmed ? 'dimmed' : ''} ${
          searchQuery && block.content.toLowerCase().includes(searchQuery.toLowerCase()) ? 'search-match' : ''
        } ${isDragOver ? 'drag-over' : ''} ${
          isDictatingThisBlock ? 'is-dictating' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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

        {/* Analysis badge (only while user explicitly requested block analysis) */}
        {isAnalyzingBlock && (
          <span className="editor-block-source analyzing">
            <IconSparkles size={12} strokeWidth={2} />
            <span>Analyse en cours…</span>
          </span>
        )}

        {/* Editable content zone — live speech streams directly inside this text area */}
        <div
          ref={ref}
          className={`editor-block-content ${isDictatingThisBlock ? 'is-dictating' : ''}`}
          contentEditable={true}
          inputMode={isDictatingThisBlock ? 'none' : 'text'}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          data-placeholder="Commencez à écrire…"
          spellCheck
          lang="fr"
        />

        {/* Actions (visible on hover, focus, or when analyzing) */}
        {(isHovered || isFocused || isAnalyzingBlock) && (
          <div className="editor-block-actions">
            {onAnalyzeBlock && block.content.trim().length > 3 && (
              <button
                type="button"
                className={`editor-block-action-btn analyze-block-btn ${isAnalyzingBlock ? 'loading' : ''}`}
                onClick={() => onAnalyzeBlock(block.id, block.content)}
                disabled={isAnalyzingBlock}
                title="Analyser ce paragraphe précis (Style, Ratures, Fact-check)"
              >
                <IconSparkles size={13} strokeWidth={2} />
                <span>{isAnalyzingBlock ? 'Analyse…' : 'Analyser ce bloc'}</span>
              </button>
            )}
            {onStartDictation && (
              <button
                type="button"
                className={`editor-block-action-btn dictation-block-btn ${isDictatingThisBlock ? 'recording' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDictateClick();
                }}
                title={isDictatingThisBlock ? "Terminer la dictée pour ce paragraphe" : "Dicter dans ce paragraphe"}
                aria-label={isDictatingThisBlock ? "Terminer la dictée" : "Dicter"}
              >
                {isDictatingThisBlock ? (
                  <>
                    <IconStop size={13} strokeWidth={2.5} />
                    <span>Terminer</span>
                  </>
                ) : (
                  <>
                    <IconMic size={13} strokeWidth={2} />
                    <span>Dicter</span>
                  </>
                )}
              </button>
            )}
            {totalBlocks > 1 && !isDictatingThisBlock && (
              <button
                type="button"
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

      {/* Subtle insertion indicator when dragging or active */}
      {isInsertionPoint ? (
        <div className="editor-insert-indicator active">
          <span className="editor-insert-dot" />
          <span className="editor-insert-text">Point d&apos;insertion de dictée</span>
        </div>
      ) : (
        <div
          className="editor-insert-line"
          onClick={() => onSetInsertionPoint(index)}
          title="Insérer un paragraphe ici"
        >
          <span className="editor-insert-line-btn">
            <IconPlus size={12} strokeWidth={2.5} />
          </span>
        </div>
      )}
    </>
  );
}
