/**
 * Editor — Editeur de blocs du manuscrit (Japandi Minimaliste)
 *
 * Assemble les EditorBlocks avec réordonnancement drag & drop ou boutons tactiles.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EditableChapter, ManuscriptAction } from '@/types/editor';
import EditorBlock from './EditorBlock';
import FloatingSelectionMenu from './FloatingSelectionMenu';
import { IconFeather, IconMic } from '@/components/Shared/Icons';

interface EditorProps {
  chapter: EditableChapter;
  chapterIndex: number;
  insertionPoint: number | null;
  dispatch: React.Dispatch<ManuscriptAction>;
  searchQuery?: string;
  focusMode?: boolean;
  onStartDictation?: () => void;
  dictationPhase?: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  onAnalyzeBlock?: (blockId: string, content: string) => void;
  analyzingBlockId?: string | null;
  onAnalyzeSelection?: (text: string) => void;
  onFactCheckSelection?: (text: string) => void;
  onCreateNoteFromSelection?: (text: string) => void;
}

export default function Editor({
  chapter,
  chapterIndex,
  insertionPoint,
  dispatch,
  searchQuery = '',
  focusMode = false,
  onStartDictation,
  dictationPhase = 'idle',
  onAnalyzeBlock,
  analyzingBlockId = null,
  onAnalyzeSelection,
  onFactCheckSelection,
  onCreateNoteFromSelection,
}: EditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<{
    position: { top: number; left: number } | null;
    text: string;
  }>({ position: null, text: '' });

  // Detect text selection inside editor blocks for the Notion-style floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelectionMenu({ position: null, text: '' });
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 3) {
        setSelectionMenu({ position: null, text: '' });
        return;
      }
      const anchorNode = sel.anchorNode;
      if (!anchorNode) return;
      const parentElem = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
      if (!parentElem || !parentElem.closest('.editor-block-content')) {
        setSelectionMenu({ position: null, text: '' });
        return;
      }

      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionMenu({
          position: {
            top: rect.top,
            left: rect.left + rect.width / 2,
          },
          text,
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleUpdate = useCallback(
    (blockId: string, content: string) => {
      dispatch({ type: 'UPDATE_BLOCK', chapterIndex, blockId, content });
    },
    [chapterIndex, dispatch]
  );

  const handleDelete = useCallback(
    (blockId: string) => {
      dispatch({ type: 'DELETE_BLOCK', chapterIndex, blockId });
    },
    [chapterIndex, dispatch]
  );

  const handleSplit = useCallback(
    (blockId: string, splitAt: number) => {
      dispatch({ type: 'SPLIT_BLOCK', chapterIndex, blockId, splitAt });
    },
    [chapterIndex, dispatch]
  );

  const handleMergeWithPrevious = useCallback(
    (blockId: string) => {
      const idx = chapter.blocks.findIndex((b) => b.id === blockId);
      if (idx <= 0) return;
      const prevBlock = chapter.blocks[idx - 1];
      dispatch({ type: 'MERGE_BLOCKS', chapterIndex, blockId, withPreviousId: prevBlock.id });
    },
    [chapter.blocks, chapterIndex, dispatch]
  );

  const handleInsertAfter = useCallback(
    (blockId: string) => {
      dispatch({ type: 'ADD_BLOCK', chapterIndex, afterBlockId: blockId });
    },
    [chapterIndex, dispatch]
  );

  const handleSetInsertionPoint = useCallback(
    (blockIndex: number | null) => {
      dispatch({ type: 'SET_INSERTION_POINT', blockIndex });
    },
    [dispatch]
  );

  const handleFocus = useCallback((blockId: string) => {
    setFocusedBlockId(blockId);
  }, []);

  // Drag & drop
  const handleDragStart = useCallback((index: number) => {
    setDragFromIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
      dispatch({ type: 'MOVE_BLOCK', chapterIndex, fromIndex: dragFromIndex, toIndex: dragOverIndex });
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  }, [dragFromIndex, dragOverIndex, chapterIndex, dispatch]);

  if (!chapter || chapter.blocks.length === 0) {
    return (
      <div className="editor-empty">
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconFeather size={32} strokeWidth={1.5} />
          </div>
          <div className="empty-state-text">
            Ce chapitre est vide. Commencez à écrire ou utilisez la dictée vocale.
          </div>
          <div className="empty-state-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'ADD_BLOCK', chapterIndex, afterBlockId: null });
                setTimeout(() => {
                  const firstBlock = document.querySelector('.editor-block textarea') as HTMLTextAreaElement;
                  if (firstBlock) firstBlock.focus();
                }, 50);
              }}
            >
              <IconFeather size={16} strokeWidth={2} />
              <span>Écrire</span>
            </button>
            {onStartDictation && (
              <button
                className="btn btn-secondary"
                onClick={onStartDictation}
                disabled={dictationPhase !== 'idle' && dictationPhase !== 'complete' && dictationPhase !== 'error'}
              >
                <IconMic size={16} strokeWidth={2} />
                <span>Dicter</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-blocks">
      {/* Floating Selection Menu (Notion Style) */}
      {selectionMenu.position && (
        <FloatingSelectionMenu
          position={selectionMenu.position}
          selectedText={selectionMenu.text}
          onAnalyzeStyle={(text) => onAnalyzeSelection?.(text)}
          onFactCheck={(text) => onFactCheckSelection?.(text)}
          onCreateNote={(text) => onCreateNoteFromSelection?.(text)}
          onClose={() => setSelectionMenu({ position: null, text: '' })}
          isAnalyzing={analyzingBlockId === 'selection'}
        />
      )}

      {chapter.blocks.map((block, i) => (
        <EditorBlock
          key={block.id}
          block={block}
          index={i}
          isInsertionPoint={insertionPoint === i}
          isFocused={focusedBlockId === block.id}
          isDimmed={focusMode && focusedBlockId !== null && focusedBlockId !== block.id}
          searchQuery={searchQuery}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSplit={handleSplit}
          onMergeWithPrevious={handleMergeWithPrevious}
          onInsertAfter={handleInsertAfter}
          onSetInsertionPoint={handleSetInsertionPoint}
          onStartDictation={onStartDictation}
          onAnalyzeBlock={onAnalyzeBlock}
          isAnalyzingBlock={analyzingBlockId === block.id}
          onFocus={handleFocus}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          isDragOver={dragOverIndex === i}
          totalBlocks={chapter.blocks.length}
        />
      ))}
    </div>
  );
}
