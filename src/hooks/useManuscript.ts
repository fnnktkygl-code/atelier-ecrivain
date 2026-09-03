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

    // Re-key footnotes array strictly as Note 1, Note 2, Note 3...
    const existingMarginNotes = ch.notes.filter((n) => n.category === 'margin');
    const updatedFootnotes: EditableNote[] = legacyKeysOrder.map((oldKey, idx) => {
      const existingNote = ch.notes.find((n) => {
        if (n.category === 'margin') return false;
        const num = n.key ? String(n.key).replace(/\D/g, '') : '';
        return num === oldKey;
      }) || ch.notes.filter((n) => n.category !== 'margin')[idx];

      const noteContent = existingNote ? existingNote.content : (NOTES[oldKey] || `Note ${idx + 1}`);

      return {
        id: existingNote ? existingNote.id : uid(),
        key: `Note ${idx + 1}`,
        content: noteContent,
        category: 'footnote' as const,
        source: (existingNote ? existingNote.source : 'original') as 'manual' | 'ai' | 'original',
      };
    });

    const updatedNotes: EditableNote[] = [...updatedFootnotes, ...existingMarginNotes];

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

  // If this is default or static demo, use static demo chapters
  // If this is a specific user manuscript (e.g. newly created book), initialize with 1 clean chapter
  const isDefaultOrDemo = manuscriptId === 'default' || manuscriptId === 'ms-1';
  const initialChapters: EditableChapter[] = isDefaultOrDemo
    ? migrateFromStatic()
    : [
        {
          id: 'ch-1',
          title: 'Chapitre 1 — Nouveau chapitre',
          blocks: [makeBlock('', 'manual')],
          notes: [],
          pendingReviews: [],
        },
      ];

  return {
    chapters: initialChapters,
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
      } else if (action.afterBlockId) {
        const idx = ch.blocks.findIndex((b) => b.id === action.afterBlockId);
        if (idx !== -1) {
          ch.blocks = [...ch.blocks.slice(0, idx + 1), newBlock, ...ch.blocks.slice(idx + 1)];
        } else {
          ch.blocks = [...ch.blocks, newBlock];
        }
      } else {
        ch.blocks = [...ch.blocks, newBlock];
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
      if (ch.blocks.length <= 1) {
        // Keep at least one empty block
        ch.blocks = [makeBlock('', 'manual')];
      } else {
        ch.blocks = ch.blocks.filter((b) => b.id !== action.blockId);
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
      const blockIdx = ch.blocks.findIndex((b) => b.id === action.blockId);
      if (blockIdx === -1) return state;

      const currentBlock = ch.blocks[blockIdx];
      const splitPos = typeof action.splitAt === 'number' ? action.splitAt : 0;
      const before = currentBlock.content.slice(0, splitPos);
      const after = currentBlock.content.slice(splitPos);

      const updatedCurrent = { ...currentBlock, content: before };
      const newBlock = makeBlock(after, currentBlock.source || 'manual', currentBlock.type || 'paragraph');

      ch.blocks = [
        ...ch.blocks.slice(0, blockIdx),
        updatedCurrent,
        newBlock,
        ...ch.blocks.slice(blockIdx + 1),
      ];
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

      const prevBlock = ch.blocks[prevIdx];
      const curBlock = ch.blocks[curIdx];
      const p1 = prevBlock.content || '';
      const p2 = curBlock.content || '';
      const needsSpace = p1 && p2 && !/\s$/.test(p1) && !/^\s/.test(p2) && !/[.,!?;:]$/.test(p1);
      const mergedContent = p1 + (needsSpace ? ' ' : '') + p2;

      const updatedPrev = { ...prevBlock, content: mergedContent };
      const blocks = [...ch.blocks];
      blocks[prevIdx] = updatedPrev;
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
    case 'SET_ACTIVE_CHAPTER':
      return {
        ...state,
        activeChapterIndex: Math.max(0, Math.min(action.index, state.chapters.length - 1)),
        insertionPoint: null,
      };

    case 'ADD_CHAPTER': {
      const newChapter: EditableChapter = {
        id: uid(),
        title: action.title,
        blocks: [makeBlock('', 'manual')],
        notes: [],
        pendingReviews: [],
      };
      return {
        ...state,
        chapters: [...state.chapters, newChapter],
        activeChapterIndex: state.chapters.length,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'RENAME_CHAPTER': {
      const chapters = [...state.chapters];
      if (chapters[action.chapterIndex]) {
        chapters[action.chapterIndex] = {
          ...chapters[action.chapterIndex],
          title: action.title,
        };
      }
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
      const newActive = Math.min(state.activeChapterIndex, chapters.length - 1);
      return {
        ...state,
        chapters,
        activeChapterIndex: newActive,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    case 'MOVE_CHAPTER': {
      const chapters = [...state.chapters];
      const [moved] = chapters.splice(action.fromIndex, 1);
      chapters.splice(action.toIndex, 0, moved);
      return {
        ...state,
        chapters,
        activeChapterIndex: action.toIndex,
        isDirty: true,
        lastSaved: now,
        saveStatus: 'saving',
      };
    }

    // ── Note operations ──
    case 'ADD_NOTE': {
      const chapters = [...state.chapters];
      const ch = { ...chapters[action.chapterIndex] };
      const category = action.category || 'footnote';

      const existingFootnotes = ch.notes.filter((n) => n.category !== 'margin');
      const nextNoteNum = existingFootnotes.length + 1;
      const key = category === 'margin' ? 'Pense-bête' : `Note ${nextNoteNum}`;

      const newNote: EditableNote = {
        id: uid(),
        key,
        content: action.content,
        category,
        source: 'manual',
      };

      ch.notes = [...ch.notes, newNote];
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
      const existingReviews = ch.pendingReviews || [];
      const currentActivePending = existingReviews.filter((r) => r.status === 'pending');
      const maxAllowedNew = Math.max(0, 15 - currentActivePending.length);
      const reviewsToAdd = action.reviews.slice(0, maxAllowedNew);

      ch.pendingReviews = [...existingReviews, ...reviewsToAdd];
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
      if (review && review.suggestion) {
        let replacementDone = false;
        if (review.attachedToBlockId) {
          ch.blocks = ch.blocks.map((b) => {
            if (b.id === review.attachedToBlockId && b.content.includes(review.original)) {
              replacementDone = true;
              return { ...b, content: b.content.replace(review.original, review.suggestion!) };
            }
            return b;
          });
        }
        if (!replacementDone) {
          ch.blocks = ch.blocks.map((b) => ({
            ...b,
            content: b.content.replace(review.original, review.suggestion!),
          }));
        }
      }
      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.id === action.reviewId ? { ...r, status: 'accepted' as const } : r
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

    case 'APPLY_ALL_REVIEWS': {
      const chapters = [...state.chapters];
      if (!chapters[action.chapterIndex]) return state;
      const ch = { ...chapters[action.chapterIndex] };
      const pendingList = ch.pendingReviews.filter((r) => r.status === 'pending' && r.suggestion);

      pendingList.forEach((review) => {
        let replacementDone = false;
        if (review.attachedToBlockId) {
          ch.blocks = ch.blocks.map((b) => {
            if (b.id === review.attachedToBlockId && b.content.includes(review.original)) {
              replacementDone = true;
              return { ...b, content: b.content.replace(review.original, review.suggestion!) };
            }
            return b;
          });
        }
        if (!replacementDone) {
          ch.blocks = ch.blocks.map((b) => ({
            ...b,
            content: b.content.replace(review.original, review.suggestion!),
          }));
        }
      });

      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.status === 'pending' ? { ...r, status: 'accepted' as const } : r
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

    case 'REJECT_ALL_REVIEWS': {
      const chapters = [...state.chapters];
      if (!chapters[action.chapterIndex]) return state;
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = ch.pendingReviews.map((r) =>
        r.status === 'pending' ? { ...r, status: 'rejected' as const } : r
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

    case 'CLEAR_ARCHIVED_REVIEWS': {
      const chapters = [...state.chapters];
      if (!chapters[action.chapterIndex]) return state;
      const ch = { ...chapters[action.chapterIndex] };
      ch.pendingReviews = ch.pendingReviews.filter((r) => r.status === 'pending');
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
  'ACCEPT_REVIEW', 'REJECT_REVIEW', 'CLEAR_ARCHIVED_REVIEWS',
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      saveManuscriptToStorage(currentManuscriptId, state);
    } catch (e) {
      console.warn('[useManuscript] Erreur de sauvegarde locale immédiate:', e);
    }
  }, [state, currentManuscriptId]);

  // 2. REAL-TIME CLOUD FIRESTORE SYNCHRONIZATION (Debounced 500ms)
  // CRITICAL: Only push when the author has dirty changes authored on THIS device
  useEffect(() => {
    if (!user || !manuscript?.id) return;
    if (typeof window === 'undefined') return;

    // Never sync to cloud unless state is actively dirty from a user edit!
    if (!state.isDirty) {
      return;
    }

    const chaptersJson = JSON.stringify(state.chapters);
    if (chaptersJson === lastSyncedJsonRef.current) {
      return;
    }

    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'syncing' });
    } else {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'offline' });
    }

    const targetUid = user.uid;
    const targetManuscriptId = manuscript.id;
    const chaptersToSave = state.chapters;

    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveAllChapters(targetUid, targetManuscriptId, chaptersToSave);
        lastSyncedJsonRef.current = JSON.stringify(chaptersToSave);
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
  }, [state.chapters, state.isDirty, user?.uid, manuscript?.id]);

  // 3. INITIAL LOAD & REAL-TIME MULTI-DEVICE CLOUD RECONCILIATION
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    // Cancel any pending debounced save from a previous manuscript
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    // A. Load local storage first if available
    const localState = loadStoredManuscript(currentManuscriptId);
    if (localState && localState.chapters.length > 0) {
      dispatch({ type: 'LOAD_STATE', state: { ...localState, isDirty: false } });
      lastSyncedJsonRef.current = JSON.stringify(localState.chapters);
    } else {
      const defaultState = createInitialState(currentManuscriptId);
      dispatch({ type: 'LOAD_STATE', state: { ...defaultState, isDirty: false } });
      lastSyncedJsonRef.current = JSON.stringify(defaultState.chapters);
    }

    // B. Real-time Firestore Sync
    if (user && manuscript?.id) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'users', user.uid, 'manuscripts', manuscript.id, 'chapters'),
          orderBy('order')
        );

        unsub = onSnapshot(
          q,
          (snapshot) => {
            if (cancelled) return;

            if (!snapshot.empty) {
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
                  notes: (data.notes && data.notes.length > 0 ? data.notes : staticChapters[idx]?.notes || []).map((n: unknown, nIdx: number) => ({
                    id: (n as { id?: string }).id || `n-${idx}-${nIdx}`,
                    key: (n as { key?: string }).key || `Note ${nIdx + 1}`,
                    content: typeof n === 'string' ? n : (n as { content?: string }).content || '',
                    source: (((n as { source?: string }).source === 'ai' || (n as { source?: string }).source === 'manual') ? (n as { source?: string }).source : 'original') as 'original' | 'manual' | 'ai',
                    category: (n as { category?: string }).category === 'margin' ? ('margin' as const) : ('footnote' as const),
                  })),
                  pendingReviews: (data.pendingReviews as PendingReview[] | undefined) || [],
                };
              });

              const cloudNormalized = normalizeChapterNotesAndSuperscripts(rawChapters);
              const cloudJson = JSON.stringify(cloudNormalized);
              const curJson = JSON.stringify(stateRef.current.chapters);

              // If cloud data differs and current state is not actively dirty locally -> Load cloud data!
              if (cloudJson !== curJson && !stateRef.current.isDirty) {
                lastSyncedJsonRef.current = cloudJson;
                const newState: ManuscriptState = {
                  chapters: cloudNormalized,
                  activeChapterIndex: Math.min(stateRef.current.activeChapterIndex, Math.max(0, cloudNormalized.length - 1)),
                  insertionPoint: null,
                  isDirty: false,
                  lastSaved: Date.now(),
                  lastCloudSync: Date.now(),
                  saveStatus: 'synced',
                };
                dispatch({ type: 'LOAD_STATE', state: newState });
                saveManuscriptToStorage(currentManuscriptId, newState);
              }
            }
          },
          (err) => {
            console.warn('[useManuscript] onSnapshot listener error:', err);
          }
        );
      } catch (e) {
        console.warn('[useManuscript] Firestore init listener error:', e);
      }
    }

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user?.uid, manuscript?.id, currentManuscriptId]);

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
