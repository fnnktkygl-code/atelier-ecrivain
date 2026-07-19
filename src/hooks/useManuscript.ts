/**
 * useManuscript Hook
 *
 * Central state management for the interactive manuscript editor.
 * Handles: blocks CRUD, chapters CRUD, notes CRUD, reviews, undo/redo, localStorage persistence.
 */

'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import type {
  ManuscriptState,
  ManuscriptAction,
  EditableChapter,
  TextBlock,
  EditableNote,
  PendingReview,
} from '@/types/editor';
import { CHAPTERS } from '@/data/chapters';
import { NOTES } from '@/data/notes';

const STORAGE_KEY = 'atelier-manuscrit-v1';

// ── Helpers ──

let _idCounter = 0;
function uid(): string {
  return `${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeBlock(content: string, source: TextBlock['source'] = 'manual', type: TextBlock['type'] = 'paragraph'): TextBlock {
  return { id: uid(), content, type, source, createdAt: Date.now() };
}

/** Migrate the static CHAPTERS + NOTES data into EditableChapter[] */
function migrateFromStatic(): EditableChapter[] {
  // Build note lookup by chapter (scan paragraphs for superscript numbers)
  const supMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  };

  return CHAPTERS.map((ch, idx) => {
    // Convert paragraphs to blocks
    const blocks: TextBlock[] = ch.paragraphs.map((p) => makeBlock(p, 'original'));

    // Extract note keys from paragraphs
    const noteKeys: string[] = [];
    ch.paragraphs.forEach((p) => {
      const matches = p.match(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g);
      if (matches) {
        matches.forEach((m) => {
          const num = m.split('').map((c) => supMap[c] || c).join('');
          if (NOTES[num] && !noteKeys.includes(num)) {
            noteKeys.push(num);
          }
        });
      }
    });

    const notes: EditableNote[] = noteKeys.map((key) => ({
      id: uid(),
      key,
      content: NOTES[key],
      source: 'original' as const,
    }));

    // Extract title
    const title = ch.title.split('—')[1]?.trim() || ch.title;

    return {
      id: uid(),
      title: `Chapitre ${idx + 1} — ${title}`,
      blocks,
      notes,
      pendingReviews: [],
    };
  });
}

function createInitialState(): ManuscriptState {
  return {
    chapters: migrateFromStatic(),
    activeChapterIndex: 0,
    insertionPoint: null,
    isDirty: false,
    lastSaved: null,
  };
}

// ── Reducer ──

function manuscriptReducer(state: ManuscriptState, action: ManuscriptAction): ManuscriptState {
  switch (action.type) {
    // ── Block operations ──
    case 'UPDATE_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.blocks = ch.blocks.map((b) =>
        b.id === action.blockId ? { ...b, content: action.content } : b
      );
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'ADD_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const newBlock = makeBlock(action.content || '', 'manual', action.blockType || 'paragraph');
      if (action.afterBlockId === null) {
        ch.blocks = [newBlock, ...ch.blocks];
      } else {
        const idx = ch.blocks.findIndex((b) => b.id === action.afterBlockId);
        ch.blocks = [...ch.blocks];
        ch.blocks.splice(idx + 1, 0, newBlock);
      }
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'DELETE_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.blocks = ch.blocks.filter((b) => b.id !== action.blockId);
      // Always keep at least one block
      if (ch.blocks.length === 0) {
        ch.blocks = [makeBlock('', 'manual')];
      }
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'MOVE_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const blocks = [...ch.blocks];
      const [moved] = blocks.splice(action.fromIndex, 1);
      blocks.splice(action.toIndex, 0, moved);
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'SPLIT_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const idx = ch.blocks.findIndex((b) => b.id === action.blockId);
      if (idx === -1) return state;
      const block = ch.blocks[idx];
      const before = block.content.slice(0, action.splitAt);
      const after = block.content.slice(action.splitAt);
      const blocks = [...ch.blocks];
      blocks[idx] = { ...block, content: before };
      blocks.splice(idx + 1, 0, makeBlock(after, block.source, block.type));
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'MERGE_BLOCKS': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const prevIdx = ch.blocks.findIndex((b) => b.id === action.withPreviousId);
      const curIdx = ch.blocks.findIndex((b) => b.id === action.blockId);
      if (prevIdx === -1 || curIdx === -1) return state;
      const blocks = [...ch.blocks];
      const mergedContent = blocks[prevIdx].content + blocks[curIdx].content;
      blocks[prevIdx] = { ...blocks[prevIdx], content: mergedContent };
      blocks.splice(curIdx, 1);
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'INSERT_DICTATION': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const blocks = [...ch.blocks];
      const insertAt = action.afterBlockIndex !== null
        ? action.afterBlockIndex + 1
        : blocks.length;
      blocks.splice(insertAt, 0, ...action.blocks);
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true, insertionPoint: null };
    }

    // ── Chapter operations ──
    case 'ADD_CHAPTER': {
      const chapters = [...state.chapters];
      const newChapter: EditableChapter = {
        id: uid(),
        title: action.title,
        blocks: [makeBlock('', 'manual')],
        notes: [],
        pendingReviews: [],
      };
      chapters.push(newChapter);
      return { ...state, chapters, activeChapterIndex: chapters.length - 1, isDirty: true };
    }

    case 'RENAME_CHAPTER': {
      const chapters = [...state.chapters];
      chapters[action.chapterIndex] = { ...chapters[action.chapterIndex], title: action.title };
      return { ...state, chapters, isDirty: true };
    }

    case 'DELETE_CHAPTER': {
      if (state.chapters.length <= 1) return state; // Keep at least one
      const chapters = state.chapters.filter((_, i) => i !== action.chapterIndex);
      const activeChapterIndex = Math.min(state.activeChapterIndex, chapters.length - 1);
      return { ...state, chapters, activeChapterIndex, isDirty: true };
    }

    case 'MOVE_CHAPTER': {
      const chapters = [...state.chapters];
      const [moved] = chapters.splice(action.fromIndex, 1);
      chapters.splice(action.toIndex, 0, moved);
      // Adjust active index
      let activeChapterIndex = state.activeChapterIndex;
      if (state.activeChapterIndex === action.fromIndex) {
        activeChapterIndex = action.toIndex;
      } else if (action.fromIndex < state.activeChapterIndex && action.toIndex >= state.activeChapterIndex) {
        activeChapterIndex--;
      } else if (action.fromIndex > state.activeChapterIndex && action.toIndex <= state.activeChapterIndex) {
        activeChapterIndex++;
      }
      return { ...state, chapters, activeChapterIndex, isDirty: true };
    }

    case 'SET_ACTIVE_CHAPTER':
      return { ...state, activeChapterIndex: action.index, insertionPoint: null };

    // ── Note operations ──
    case 'ADD_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const nextKey = String(ch.notes.length + 1);
      const note: EditableNote = {
        id: uid(),
        key: nextKey,
        content: action.content,
        source: 'manual',
        attachedToBlockId: action.attachedToBlockId,
      };
      ch.notes = [...ch.notes, note];
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'UPDATE_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.notes = ch.notes.map((n) =>
        n.id === action.noteId ? { ...n, content: action.content } : n
      );
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'DELETE_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.notes = ch.notes.filter((n) => n.id !== action.noteId);
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    // ── Review operations ──
    case 'ADD_REVIEWS': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = [...ch.pendingReviews, ...action.reviews];
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'ACCEPT_REVIEW': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.id === action.reviewId ? { ...r, status: 'accepted' as const } : r
      );
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    case 'REJECT_REVIEW': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.id === action.reviewId ? { ...r, status: 'rejected' as const } : r
      );
      chapters[action.chapterIndex] = ch;
      return { ...state, chapters, isDirty: true };
    }

    // ── Meta ──
    case 'SET_INSERTION_POINT':
      return { ...state, insertionPoint: action.blockIndex };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, lastSaved: Date.now() };

    case 'LOAD_STATE':
      return { ...action.state, isDirty: false };

    default:
      return state;
  }
}

// ── Undo/Redo wrapper ──

interface UndoableState {
  present: ManuscriptState;
  past: ManuscriptState[];
  future: ManuscriptState[];
}

const MAX_UNDO = 50;

// Actions that should trigger undo snapshots
const UNDOABLE_ACTIONS = new Set([
  'UPDATE_BLOCK', 'ADD_BLOCK', 'DELETE_BLOCK', 'MOVE_BLOCK',
  'SPLIT_BLOCK', 'MERGE_BLOCKS', 'INSERT_DICTATION',
  'ADD_CHAPTER', 'RENAME_CHAPTER', 'DELETE_CHAPTER', 'MOVE_CHAPTER',
  'ADD_NOTE', 'UPDATE_NOTE', 'DELETE_NOTE',
  'ACCEPT_REVIEW', 'REJECT_REVIEW',
]);

function undoableReducer(state: UndoableState, action: ManuscriptAction | { type: 'UNDO' } | { type: 'REDO' }): UndoableState {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    default: {
      const newPresent = manuscriptReducer(state.present, action);
      if (newPresent === state.present) return state;

      // Only push to undo stack for content-changing actions
      if (UNDOABLE_ACTIONS.has(action.type)) {
        return {
          past: [...state.past.slice(-MAX_UNDO), state.present],
          present: newPresent,
          future: [], // Clear redo on new action
        };
      }
      return { ...state, present: newPresent };
    }
  }
}

// ── Hook ──

export function useManuscript() {
  const [undoState, dispatch] = useReducer(undoableReducer, undefined, () => ({
    past: [],
    present: createInitialState(),
    future: [],
  }));

  const { present: state } = undoState;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ManuscriptState;
        if (parsed.chapters && parsed.chapters.length > 0) {
          dispatch({ type: 'LOAD_STATE', state: parsed });
        }
      }
    } catch {
      // Ignore — start fresh
    }
  }, []);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (!state.isDirty) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        dispatch({ type: 'MARK_SAVED' });
      } catch {
        // Storage full — ignore
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // ── Convenience methods ──

  const activeChapter = state.chapters[state.activeChapterIndex] || state.chapters[0];

  const wordCount = activeChapter
    ? activeChapter.blocks.reduce((sum, b) => sum + b.content.split(/\s+/).filter(Boolean).length, 0)
    : 0;

  const totalWordCount = state.chapters.reduce(
    (sum, ch) => sum + ch.blocks.reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0),
    0
  );

  const pendingReviewCount = activeChapter
    ? activeChapter.pendingReviews.filter((r) => r.status === 'pending').length
    : 0;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const canUndo = undoState.past.length > 0;
  const canRedo = undoState.future.length > 0;

  const exportMarkdown = useCallback(() => {
    const md = state.chapters.map((ch) => {
      const title = `# ${ch.title}\n\n`;
      const body = ch.blocks.map((b) => {
        if (b.type === 'heading') return `## ${b.content}\n`;
        if (b.type === 'quote') return `> ${b.content}\n`;
        return `${b.content}\n`;
      }).join('\n');
      const notes = ch.notes.length > 0
        ? '\n---\n\n' + ch.notes.map((n) => `[^${n.key}]: ${n.content}`).join('\n') + '\n'
        : '';
      return title + body + notes;
    }).join('\n\n---\n\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manuscrit.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.chapters]);

  return {
    state,
    activeChapter,
    dispatch,
    wordCount,
    totalWordCount,
    pendingReviewCount,
    undo,
    redo,
    canUndo,
    canRedo,
    exportMarkdown,
  };
}
