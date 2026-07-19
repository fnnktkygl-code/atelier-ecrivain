/**
 * Editor — Main manuscript editor
 *
 * Assembles EditorBlocks with drag & drop reordering.
 * Receives actions from useManuscript.
 */

'use client';

import { useState, useCallback } from 'react';
import type { EditableChapter, ManuscriptAction } from '@/types/editor';
import EditorBlock from './EditorBlock';

interface EditorProps {
  chapter: EditableChapter;
  chapterIndex: number;
  insertionPoint: number | null;
  dispatch: React.Dispatch<ManuscriptAction>;
  searchQuery?: string;
  focusMode?: boolean;
}

export default function Editor({ chapter, chapterIndex, insertionPoint, dispatch, searchQuery = '', focusMode = false }: EditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-text">
            Ce chapitre est vide. Commencez à écrire ou utilisez la dictée vocale.
          </div>
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'ADD_BLOCK', chapterIndex, afterBlockId: null })}
          >
            Commencer à écrire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-blocks">
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
