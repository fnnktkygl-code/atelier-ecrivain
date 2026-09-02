/**
 * useManuscript Hook
 *
 * Central state management for the interactive manuscript editor.
 * Hybrid persistence:
 * - Instant local storage auto-save (0ms latency, zero loss on refresh)
 * - Cloud Firestore synchronization (debounced 500ms & real-time onSnapshot)
 * - Bi-directional timestamp conflict resolution (phone <-> computer)
 * - Visual status tracking (saving, saved locally, synced with cloud, offline)
 */

'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import {
  getChapters,
  saveAllChapters,
  getDb,
  getManuscriptMeta,
  toTimestampMillis,
} from '@/services/firebase/firestore';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import type {
  ManuscriptState,
  ManuscriptAction,
  EditableChapter,
  TextBlock,
  EditableNote,
  PendingReview,
  SaveStatus,
} from '@/types/editor';
import { CHAPTERS } from '@/data/chapters';
import { NOTES } from '@/data/notes';

// ── Storage Keys ──
export function getPrimaryStorageKey(manuscriptId: string = 'default'): string {
  return `atelier_manuscript_${manuscriptId || 'default'}`;
}

export function getAllLegacyKeys(manuscriptId: string = 'default'): string[] {
  return [
    `atelier_manuscript_${manuscriptId || 'default'}`,
    `atelier-manuscrit-v4-${manuscriptId || 'default'}`,
    `atelier-manuscrit-${manuscriptId || 'default'}`,
    'atelier_manuscript_default',
    'atelier-manuscrit-default',
    'atelier-manuscrit-v1',
  ];
}

// ── Helpers ──

let _idCounter = 0;
export function uid(): string {
  return `${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeBlock(
  content: string,
  source: TextBlock['source'] = 'manual',
  type: TextBlock['type'] = 'paragraph'
): TextBlock {
  return { id: uid(), content, type, source, createdAt: Date.now() };
}

export function toSuperscript(num: number): string {
  const sups: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  return String(num).split('').map((digit) => sups[digit] || digit).join('');
}

/** Re-index all chapters so every chapter's note list starts at Note 1 with matching ¹, ², ³ superscripts */
export function normalizeChapterNotesAndSuperscripts(chapters: EditableChapter[]): EditableChapter[] {
  const supMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  };

  return chapters.map((ch) => {
    // Collect all note keys referenced in blocks or notes array
    const legacyKeysOrder: string[] = [];

    // Scan blocks in order for note reference markers
    ch.blocks.forEach((block) => {
      const matches = block.content.match(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g);
      if (matches) {
        matches.forEach((m) => {
          const num = m.split('').map((c) => supMap[c] || c).join('');
          if (!legacyKeysOrder.includes(num)) {
            legacyKeysOrder.push(num);
          }
        });
      }
    });

    // Also include any notes that exist in ch.notes but weren't in text regex
    ch.notes.forEach((n, idx) => {
      const num = n.key ? String(n.key).replace(/\D/g, '') || String(idx + 1) : String(idx + 1);
      if (!legacyKeysOrder.includes(num)) {
        legacyKeysOrder.push(num);
      }
    });

    // Map old key (e.g. "10", "11", "12") -> 1-based index (1, 2, 3...)
    const oldKeyToNewIndex: Record<string, number> = {};
    legacyKeysOrder.forEach((oldKey, idx) => {
      oldKeyToNewIndex[oldKey] = idx + 1;
    });

    // Also map sequential index if notes were already re-keyed as 1..N
    ch.notes.forEach((n, idx) => {
      const num = n.key ? String(n.key).replace(/\D/g, '') : String(idx + 1);
      if (oldKeyToNewIndex[num] === undefined) {
        oldKeyToNewIndex[num] = idx + 1;
      }
    });

    // Replace text block superscripts with per-chapter 1-based superscripts
    const updatedBlocks = ch.blocks.map((block) => {
      let content = block.content;
      content = content.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => {
        const oldNum = m.split('').map((c) => supMap[c] || c).join('');
        const newNum = oldKeyToNewIndex[oldNum];
        if (newNum !== undefined) {
          return toSuperscript(newNum);
        }
        return m;
      });
      return { ...block, content };
    });

    // Re-key notes array strictly as Note 1, Note 2, Note 3...
    const updatedNotes: EditableNote[] = legacyKeysOrder.map((oldKey, idx) => {
      const existingNote = ch.notes.find((n) => {
        const num = n.key ? String(n.key).replace(/\D/g, '') : '';
        return num === oldKey;
      }) || ch.notes[idx];

      const noteContent = existingNote ? existingNote.content : (NOTES[oldKey] || `Note ${idx + 1}`);

      return {
        id: existingNote ? existingNote.id : uid(),
        key: `Note ${idx + 1}`,
        content: noteContent,
        source: (existingNote ? existingNote.source : 'original') as 'manual' | 'ai' | 'original',
      };
    });

    return {
      ...ch,
      blocks: updatedBlocks.length > 0 ? updatedBlocks : [makeBlock('', 'manual')],
      notes: updatedNotes,
    };
  });
}

/** Migrate the static CHAPTERS + NOTES data into EditableChapter[] */
export function migrateFromStatic(): EditableChapter[] {
  const rawChapters: EditableChapter[] = CHAPTERS.map((ch, idx) => {
    const blocks: TextBlock[] = ch.paragraphs.map((p) => makeBlock(p, 'original'));
    const title = ch.title.split('—')[1]?.trim() || ch.title;
    return {
      id: `ch-static-${idx + 1}`,
      title: `Chapitre ${idx + 1} — ${title}`,
      blocks: blocks.length > 0 ? blocks : [makeBlock('', 'manual')],
      notes: [],
      pendingReviews: [],
    };
  });

  return normalizeChapterNotesAndSuperscripts(rawChapters);
}

/**
 * Load and validate a persisted manuscript state from LocalStorage.
 * Scans primary key, legacy keys, and any other candidate key.
 */
export function loadStoredManuscript(manuscriptId: string = 'default'): ManuscriptState | null {
  if (typeof window === 'undefined') return null;

  try {
    const keysToTry = [
      getPrimaryStorageKey(manuscriptId),
      `atelier-manuscrit-v4-${manuscriptId}`,
      `atelier-manuscrit-${manuscriptId}`,
    ];

    if (manuscriptId === 'default' || !manuscriptId) {
      keysToTry.push('atelier_manuscript_default', 'atelier-manuscrit-default', 'atelier-manuscrit-v1');
    }

    // Also scan any matching keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('atelier_manuscript_') || k.startsWith('atelier-manuscrit'))) {
        if (!keysToTry.includes(k)) {
          keysToTry.push(k);
        }
      }
    }

    let bestParsed: ManuscriptState | null = null;

    for (const key of keysToTry) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Partial<ManuscriptState>;
        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
          // Validate structure
          const validChapters = parsed.chapters.map((ch, idx) => ({
            id: ch.id || `ch-${idx + 1}`,
            title: ch.title || `Chapitre ${idx + 1}`,
            blocks: Array.isArray(ch.blocks) && ch.blocks.length > 0
              ? ch.blocks.map((b) => ({
                  id: b.id || uid(),
                  content: typeof b.content === 'string' ? b.content : '',
                  type: b.type || 'paragraph',
                  source: b.source || 'manual',
                  createdAt: b.createdAt || Date.now(),
                }))
              : [makeBlock('', 'manual')],
            notes: Array.isArray(ch.notes) ? ch.notes : [],
            pendingReviews: Array.isArray(ch.pendingReviews) ? ch.pendingReviews : [],
          }));

          const candidateState: ManuscriptState = {
            chapters: normalizeChapterNotesAndSuperscripts(validChapters),
            activeChapterIndex: typeof parsed.activeChapterIndex === 'number' && parsed.activeChapterIndex < validChapters.length ? parsed.activeChapterIndex : 0,
            insertionPoint: parsed.insertionPoint ?? null,
            isDirty: false,
            lastSaved: typeof parsed.lastSaved === 'number' ? parsed.lastSaved : Date.now(),
            lastCloudSync: typeof parsed.lastCloudSync === 'number' ? parsed.lastCloudSync : null,
            saveStatus: 'saved',
          };

          if (!bestParsed) {
            bestParsed = candidateState;
          } else {
            const curSaved = candidateState.lastSaved || 0;
            const bestSaved = bestParsed.lastSaved || 0;
            if (curSaved >= bestSaved) {
              bestParsed = candidateState;
            }
          }
        }
      } catch {
        // Skip unparseable entry
      }
    }

    return bestParsed;
  } catch {
    return null;
  }
}

/**
 * Persist manuscript state immediately to LocalStorage across all relevant keys
 * and broadcast the update event.
 */
export function saveManuscriptToStorage(manuscriptId: string = 'default', state: ManuscriptState): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = JSON.stringify({
      ...state,
      isDirty: false,
    });

    const keysToSave = [
      getPrimaryStorageKey(manuscriptId),
      `atelier-manuscrit-v4-${manuscriptId}`,
      `atelier-manuscrit-${manuscriptId}`,
    ];

    if (manuscriptId === 'default' || !manuscriptId) {
      keysToSave.push('atelier_manuscript_default', 'atelier-manuscrit-default', 'atelier-manuscrit-v1');
    }

    keysToSave.forEach((k) => {
      try {
        localStorage.setItem(k, serialized);
      } catch {
        // Ignore single quota errors
      }
    });

    // Notify other components or tabs
    window.dispatchEvent(
      new CustomEvent('atelier_manuscript_updated', {
        detail: {
          manuscriptId,
          lastSaved: state.lastSaved,
          chapterCount: state.chapters.length,
        },
      })
    );
  } catch (err) {
    console.warn('[saveManuscriptToStorage] Error persisting to LocalStorage:', err);
  }
}

export function createInitialState(manuscriptId: string = 'default'): ManuscriptState {
  // Synchronous recovery if in browser
  const stored = loadStoredManuscript(manuscriptId);
  if (stored && stored.chapters.length > 0) {
    return {
      ...stored,
      isDirty: false,
      saveStatus: 'saved',
    };
  }

  return {
    chapters: migrateFromStatic(),
    activeChapterIndex: 0,
    insertionPoint: null,
    isDirty: false,
    lastSaved: Date.now(),
    lastCloudSync: null,
    saveStatus: 'saved',
  };
}

// ── Reducer ──

export function manuscriptReducer(state: ManuscriptState, action: ManuscriptAction): ManuscriptState {
  const now = Date.now();

  switch (action.type) {
    // ── Block operations ──
    case 'UPDATE_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.blocks = ch.blocks.map((b) =>
        b.id === action.blockId ? { ...b, content: action.content } : b
      );
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
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
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
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
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'MOVE_BLOCK': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const blocks = [...ch.blocks];
      const [moved] = blocks.splice(action.fromIndex, 1);
      blocks.splice(action.toIndex, 0, moved);
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
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
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'MERGE_BLOCKS': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const prevIdx = ch.blocks.findIndex((b) => b.id === action.withPreviousId);
      const curIdx = ch.blocks.findIndex((b) => b.id === action.blockId);
      if (prevIdx === -1 || curIdx === -1) return state;
      const blocks = [...ch.blocks];
      const p1 = blocks[prevIdx].content || '';
      const p2 = blocks[curIdx].content || '';
      const needsSpace = p1 && p2 && !/\s$/.test(p1) && !/^\s/.test(p2) && !/[.,!?;:]$/.test(p1);
      const mergedContent = p1 + (needsSpace ? ' ' : '') + p2;
      blocks[prevIdx] = { ...blocks[prevIdx], content: mergedContent };
      blocks.splice(curIdx, 1);
      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'INSERT_DICTATION': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const blocks = [...ch.blocks];

      const textToAppend = action.blocks.map((b) => b.content).filter(Boolean).join(' ');

      if (textToAppend) {
        if (action.afterBlockIndex !== null && blocks[action.afterBlockIndex]) {
          const targetBlock = blocks[action.afterBlockIndex];
          const updatedContent = targetBlock.content
            ? `${targetBlock.content} ${textToAppend}`
            : textToAppend;
          blocks[action.afterBlockIndex] = { ...targetBlock, content: updatedContent };
        } else if (blocks.length > 0) {
          const lastIdx = blocks.length - 1;
          const lastBlock = blocks[lastIdx];
          const updatedContent = lastBlock.content
            ? `${lastBlock.content} ${textToAppend}`
            : textToAppend;
          blocks[lastIdx] = { ...lastBlock, content: updatedContent };
        } else {
          blocks.push(makeBlock(textToAppend, 'dictation'));
        }
      }

      ch.blocks = blocks;
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        insertionPoint: null,
        lastSaved: now,
        saveStatus: 'saving',
      };
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
      return {
        ...state,
        chapters,
        activeChapterIndex: chapters.length - 1,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'RENAME_CHAPTER': {
      const chapters = [...state.chapters];
      chapters[action.chapterIndex] = { ...chapters[action.chapterIndex], title: action.title };
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'DELETE_CHAPTER': {
      if (state.chapters.length <= 1) return state; // Keep at least one
      const chapters = state.chapters.filter((_, i) => i !== action.chapterIndex);
      const activeChapterIndex = Math.min(state.activeChapterIndex, chapters.length - 1);
      return {
        ...state,
        chapters,
        activeChapterIndex,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
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
      return {
        ...state,
        chapters,
        activeChapterIndex,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'SET_ACTIVE_CHAPTER':
      return {
        ...state,
        activeChapterIndex: action.index,
        insertionPoint: null,
      };

    // ── Note operations ──
    case 'ADD_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const nextKey = `Note ${ch.notes.length + 1}`;
      const note: EditableNote = {
        id: uid(),
        key: nextKey,
        content: action.content,
        source: 'manual',
        attachedToBlockId: action.attachedToBlockId,
      };
      ch.notes = [...ch.notes, note];
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'UPDATE_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.notes = ch.notes.map((n) =>
        n.id === action.noteId ? { ...n, content: action.content } : n
      );
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'DELETE_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.notes = ch.notes.filter((n) => n.id !== action.noteId);
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    // ── Review operations ──
    case 'ADD_REVIEWS': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = [...ch.pendingReviews, ...action.reviews];
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'ACCEPT_REVIEW': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const review = ch.pendingReviews.find((r) => r.id === action.reviewId);

      if (review && review.status === 'pending') {
        const targetNoteNum = ch.notes.length + 1;
        const supChar = toSuperscript(targetNoteNum);

        // 1. Attach ONLY the superscript marker to target phrase in story block
        const target = review.original ? review.original.trim() : '';
        let marked = false;

        if (target && target.length > 2) {
          ch.blocks = ch.blocks.map((block) => {
            if (!marked && block.content.includes(target)) {
              marked = true;
              return {
                ...block,
                content: block.content.replace(target, `${target}${supChar}`),
              };
            }
            return block;
          });
        }

        // If target phrase was not matched, attach to end of paragraph
        if (!marked && ch.blocks.length > 0) {
          const lastIdx = ch.blocks.length - 1;
          const lastBlock = ch.blocks[lastIdx];
          const updatedContent = lastBlock.content ? `${lastBlock.content}${supChar}` : supChar;
          ch.blocks = ch.blocks.map((b, idx) =>
            idx === lastIdx ? { ...b, content: updatedContent } : b
          );
        }

        // 2. Add citation/source to notes
        const noteKey = `Note ${targetNoteNum}`;
        const noteContent = review.source
          ? `${review.suggestion || review.original} — Source : ${review.source}`
          : `${review.suggestion || review.original}${review.explanation ? ` (${review.explanation})` : ''}`;

        if (!ch.notes.some((n) => n.content === noteContent)) {
          ch.notes = [
            ...ch.notes,
            {
              id: uid(),
              key: noteKey,
              content: noteContent,
              source: 'ai',
            },
          ];
        }

        // 3. Mark review status as accepted
        ch.pendingReviews = ch.pendingReviews.map((r) =>
          r.id === action.reviewId ? { ...r, status: 'accepted' as const } : r
        );
      }

      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'REJECT_REVIEW': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.id === action.reviewId ? { ...r, status: 'rejected' as const } : r
      );
      chapters[action.chapterIndex] = ch;
      return {
        ...state,
        chapters,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    // ── Meta & Persistence ──
    case 'SET_INSERTION_POINT':
      return { ...state, insertionPoint: action.blockIndex };

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
        lastSaved: action.timestamp || now,
        saveStatus: state.lastCloudSync ? 'synced' : 'saved',
      };

    case 'MARK_CLOUD_SYNCED':
      return {
        ...state,
        isDirty: false,
        lastCloudSync: action.timestamp || now,
        saveStatus: 'synced',
      };

    case 'SET_SAVE_STATUS':
      return {
        ...state,
        saveStatus: action.status,
      };

    case 'LOAD_STATE':
      return {
        ...action.state,
        isDirty: false,
        saveStatus: action.state.saveStatus || 'saved',
      };

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

export function undoableReducer(state: UndoableState, action: ManuscriptAction | { type: 'UNDO' } | { type: 'REDO' }): UndoableState {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: { ...previous, isDirty: true, lastSaved: Date.now(), saveStatus: 'saving' },
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: { ...next, isDirty: true, lastSaved: Date.now(), saveStatus: 'saving' },
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
  const { user, manuscript } = useAuth();
  const currentManuscriptId = manuscript?.id || 'default';

  const [undoState, dispatch] = useReducer(undoableReducer, undefined, () => ({
    past: [],
    present: createInitialState(currentManuscriptId),
    future: [],
  }));

  const { present: state } = undoState;
  const stateRef = useRef(state);
  stateRef.current = state;

  const cloudSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedJsonRef = useRef<string>('');

  // 1. INSTANT LOCAL STORAGE AUTO-SAVE
  // Every single action immediately persists to LocalStorage with 0ms delay!
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      saveManuscriptToStorage(currentManuscriptId, state);
    } catch (e) {
      console.warn('[useManuscript] Erreur de sauvegarde locale immédiate:', e);
    }
  }, [state, currentManuscriptId]);

  // 2. REAL-TIME CLOUD FIRESTORE SYNCHRONIZATION (Debounced 500ms)
  useEffect(() => {
    if (!user || !manuscript?.id) return;
    if (typeof window === 'undefined') return;

    const chaptersJson = JSON.stringify(state.chapters);
    // Skip if already synced to Firestore and not dirty
    if (chaptersJson === lastSyncedJsonRef.current && !state.isDirty) {
      return;
    }

    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    // Set status to syncing if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'syncing' });
    } else {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'offline' });
    }

    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        const currentChapters = stateRef.current.chapters;
        await saveAllChapters(user.uid, manuscript.id, currentChapters);
        lastSyncedJsonRef.current = JSON.stringify(currentChapters);
        dispatch({ type: 'MARK_CLOUD_SYNCED', timestamp: Date.now() });
      } catch (err) {
        console.error('[useManuscript] Firestore debounced sync error:', err);
        const isOff = typeof navigator !== 'undefined' && !navigator.onLine;
        dispatch({ type: 'SET_SAVE_STATUS', status: isOff ? 'offline' : 'error' });
      }
    }, 500);

    return () => {
      if (cloudSaveTimerRef.current) {
        clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [state.chapters, state.isDirty, user, manuscript?.id]);

  // 3. INITIAL LOAD & MULTI-DEVICE CLOUD RECONCILIATION
  // Reconciles local cache vs cloud whenever active manuscript or user changes
  useEffect(() => {
    let cancelled = false;

    // Load local storage first
    const localState = loadStoredManuscript(currentManuscriptId);
    if (localState && localState.chapters.length > 0) {
      dispatch({ type: 'LOAD_STATE', state: localState });
    }

    // Fetch from Firestore if logged in
    if (user && manuscript?.id) {
      (async () => {
        try {
          const [fsMeta, fsChapters] = await Promise.all([
            getManuscriptMeta(user.uid, manuscript.id),
            getChapters(user.uid, manuscript.id),
          ]);

          if (cancelled) return;

          const cloudUpdatedAt = toTimestampMillis(fsMeta?.updatedAt);
          const localLastSaved = localState?.lastSaved || 0;

          if (fsChapters && fsChapters.length > 0) {
            const staticChapters = migrateFromStatic();
            const rawChapters: EditableChapter[] = fsChapters.map((ch, idx) => ({
              id: ch.id || `ch-${idx + 1}`,
              title: ch.title || `Chapitre ${idx + 1}`,
              blocks: (ch.blocks as TextBlock[] | undefined) || (ch.paragraphs || []).map((p) => ({
                id: uid(),
                content: p,
                type: 'paragraph' as const,
                source: 'original' as const,
                createdAt: Date.now(),
              })),
              notes: (ch.notes && ch.notes.length > 0 ? ch.notes : staticChapters[idx]?.notes || []).map((n, nIdx) => ({
                id: (n as { id?: string }).id || `n-${idx}-${nIdx}`,
                key: n.key || `Note ${nIdx + 1}`,
                content: typeof n === 'string' ? n : n.content,
                source: (((n as { source?: string }).source === 'ai' || (n as { source?: string }).source === 'manual') ? (n as { source?: string }).source : 'original') as 'original' | 'manual' | 'ai',
              })),
              pendingReviews: (ch.pendingReviews as PendingReview[] | undefined) || [],
            }));

            const cloudNormalized = normalizeChapterNotesAndSuperscripts(rawChapters);

            // Conflict resolution:
            // If Cloud is strictly newer than Local (> 2s), Cloud wins (e.g., user wrote on phone 5 mins ago)
            // If Local is newer or equal, Local wins and immediately updates Cloud!
            if (!localState || cloudUpdatedAt > (localLastSaved + 2000)) {
              const newState: ManuscriptState = {
                chapters: cloudNormalized,
                activeChapterIndex: localState?.activeChapterIndex || 0,
                insertionPoint: null,
                isDirty: false,
                lastSaved: cloudUpdatedAt || Date.now(),
                lastCloudSync: cloudUpdatedAt || Date.now(),
                saveStatus: 'synced',
              };
              dispatch({ type: 'LOAD_STATE', state: newState });
              saveManuscriptToStorage(currentManuscriptId, newState);
              lastSyncedJsonRef.current = JSON.stringify(cloudNormalized);
            } else if (localState && localState.chapters.length > 0) {
              // Local is ahead of cloud -> Push local to cloud!
              saveAllChapters(user.uid, manuscript.id, localState.chapters).then(() => {
                lastSyncedJsonRef.current = JSON.stringify(localState.chapters);
                dispatch({ type: 'MARK_CLOUD_SYNCED', timestamp: Date.now() });
              }).catch((e) => console.warn('Cloud initial push error:', e));
            }
          } else if (localState && localState.chapters.length > 0) {
            // Cloud has 0 chapters -> Initialize cloud from local state!
            saveAllChapters(user.uid, manuscript.id, localState.chapters).then(() => {
              lastSyncedJsonRef.current = JSON.stringify(localState.chapters);
              dispatch({ type: 'MARK_CLOUD_SYNCED', timestamp: Date.now() });
            }).catch((e) => console.warn('Cloud empty initialization error:', e));
          }
        } catch (err) {
          console.warn('[useManuscript] Firestore reconciliation error:', err);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [currentManuscriptId, user, manuscript?.id]);

  // 4. REAL-TIME CROSS-DEVICE SNAPSHOT LISTENER
  // Enables live updates if another device modifies the manuscript
  useEffect(() => {
    if (!user || !manuscript?.id) return;
    let unsub: (() => void) | null = null;

    try {
      const db = getDb();
      const q = query(
        collection(db, 'users', user.uid, 'manuscripts', manuscript.id, 'chapters'),
        orderBy('order')
      );

      unsub = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;

        // Skip remote sync while user is currently typing/dirty
        if (stateRef.current.isDirty) {
          return;
        }

        const staticChapters = migrateFromStatic();
        const rawChapters: EditableChapter[] = snapshot.docs.map((docSnap, idx) => {
          const data = docSnap.data();
          return {
            id: docSnap.id || `ch-${idx + 1}`,
            title: data.title || `Chapitre ${idx + 1}`,
            blocks: data.blocks || (data.paragraphs || []).map((p: string) => ({
              id: uid(),
              content: p,
              type: 'paragraph' as const,
              source: 'original' as const,
              createdAt: Date.now(),
            })),
            notes: data.notes && data.notes.length > 0 ? data.notes : staticChapters[idx]?.notes || [],
            pendingReviews: data.pendingReviews || [],
          };
        });

        const remoteChapters = normalizeChapterNotesAndSuperscripts(rawChapters);
        const remoteJson = JSON.stringify(remoteChapters);

        if (remoteJson !== JSON.stringify(stateRef.current.chapters)) {
          lastSyncedJsonRef.current = remoteJson;
          const newState: ManuscriptState = {
            ...stateRef.current,
            chapters: remoteChapters,
            isDirty: false,
            lastSaved: Date.now(),
            lastCloudSync: Date.now(),
            saveStatus: 'synced',
          };
          dispatch({ type: 'LOAD_STATE', state: newState });
          saveManuscriptToStorage(currentManuscriptId, newState);
        }
      });
    } catch (e) {
      console.warn('[useManuscript] onSnapshot listener error:', e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [user, manuscript?.id, currentManuscriptId]);

  // 5. FLUSH ON UNMOUNT, VISIBILITY CHANGE & BEFOREUNLOAD
  useEffect(() => {
    const handleFlush = () => {
      const cur = stateRef.current;
      if (cur) {
        saveManuscriptToStorage(currentManuscriptId, cur);
        if (user && manuscript?.id && cur.isDirty) {
          saveAllChapters(user.uid, manuscript.id, cur.chapters).catch(() => {});
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      handleFlush();
    };
  }, [currentManuscriptId, user, manuscript?.id]);

  // 6. MANUAL FORCE SAVE
  const forceSave = useCallback(async () => {
    const cur = stateRef.current;
    saveManuscriptToStorage(currentManuscriptId, cur);
    dispatch({ type: 'MARK_SAVED', timestamp: Date.now() });

    if (user && manuscript?.id) {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'syncing' });
      try {
        await saveAllChapters(user.uid, manuscript.id, cur.chapters);
        lastSyncedJsonRef.current = JSON.stringify(cur.chapters);
        dispatch({ type: 'MARK_CLOUD_SYNCED', timestamp: Date.now() });
      } catch (err) {
        console.error('[useManuscript] forceSave Cloud Error:', err);
        dispatch({ type: 'SET_SAVE_STATUS', status: 'error' });
      }
    }
  }, [currentManuscriptId, user, manuscript?.id]);

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

  const saveStatus: SaveStatus = state.saveStatus || (state.isDirty ? 'saving' : state.lastCloudSync ? 'synced' : 'saved');

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
    saveStatus,
    lastSaved: state.lastSaved,
    lastCloudSync: state.lastCloudSync || null,
    forceSave,
  };
}
