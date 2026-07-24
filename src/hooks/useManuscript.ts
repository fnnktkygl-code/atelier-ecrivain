/**
 * useManuscript Hook
 *
 * Central state management for the interactive manuscript editor.
 * Handles: blocks CRUD, chapters CRUD, notes CRUD, reviews, undo/redo, localStorage persistence.
 */

'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import { getChapters, saveAllChapters, getDb } from '@/services/firebase/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
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

function toSuperscript(num: number): string {
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
      blocks: updatedBlocks,
      notes: updatedNotes,
    };
  });
}

/** Migrate the static CHAPTERS + NOTES data into EditableChapter[] */
function migrateFromStatic(): EditableChapter[] {
  const rawChapters: EditableChapter[] = CHAPTERS.map((ch, idx) => {
    const blocks: TextBlock[] = ch.paragraphs.map((p) => makeBlock(p, 'original'));
    const title = ch.title.split('—')[1]?.trim() || ch.title;
    return {
      id: uid(),
      title: `Chapitre ${idx + 1} — ${title}`,
      blocks,
      notes: [],
      pendingReviews: [],
    };
  });

  return normalizeChapterNotesAndSuperscripts(rawChapters);
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
      const p1 = blocks[prevIdx].content || '';
      const p2 = blocks[curIdx].content || '';
      const needsSpace = p1 && p2 && !/\s$/.test(p1) && !/^\s/.test(p2) && !/[.,!?;:]$/.test(p1);
      const mergedContent = p1 + (needsSpace ? ' ' : '') + p2;
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
      const review = ch.pendingReviews.find((r) => r.id === action.reviewId);

      if (review && review.status === 'pending') {
        const targetNoteNum = ch.notes.length + 1;
        let supChar = '';

        // If source exists or suggestion is factual, prepare superscript digit
        if (review.source || review.type === 'correction') {
          supChar = toSuperscript(targetNoteNum);
        }

        let replacementText = review.suggestion ? review.suggestion.trim() : '';
        if (supChar && replacementText && !/[⁰¹²³⁴⁵⁶⁷⁸⁹]$/.test(replacementText)) {
          replacementText = `${replacementText} ${supChar}`;
        }

        let replaced = false;

        if (replacementText) {
          const target = review.original ? review.original.trim() : '';

          // 1. Try exact string match in chapter blocks
          if (target && target.length > 2) {
            ch.blocks = ch.blocks.map((block) => {
              if (!replaced && block.content.includes(target)) {
                replaced = true;
                return {
                  ...block,
                  content: block.content.replace(target, replacementText),
                };
              }
              return block;
            });
          }

          // 2. Try matching key phrases in blocks (e.g. "interprétation", "philosophe", "écrivain")
          if (!replaced && target) {
            const keywords = ['interprétation', 'philosophe', 'écrivain', 'disait', 'citation'];
            const matchedKeyword = keywords.find((kw) => target.toLowerCase().includes(kw));

            ch.blocks = ch.blocks.map((block) => {
              if (!replaced && matchedKeyword && block.content.toLowerCase().includes(matchedKeyword)) {
                replaced = true;
                return {
                  ...block,
                  content: replacementText,
                };
              }
              return block;
            });
          }

          // 3. Fallback: If not matched by target or keyword, append replacement text to the last block
          if (!replaced && replacementText && ch.blocks.length > 0) {
            const lastIdx = ch.blocks.length - 1;
            const lastBlock = ch.blocks[lastIdx];
            const updatedContent = lastBlock.content
              ? `${lastBlock.content}\n\n${replacementText}`
              : replacementText;
            ch.blocks = ch.blocks.map((b, idx) =>
              idx === lastIdx ? { ...b, content: updatedContent } : b
            );
            replaced = true;
          }
        }

        // 4. Create the corresponding note in ch.notes
        if (review.source || review.explanation || review.suggestion) {
          const noteKey = `Note ${targetNoteNum}`;
          const noteContent = review.source
            ? `${review.suggestion || review.original} — Source : ${review.source}`
            : `${review.suggestion || review.original} ${review.explanation ? `(${review.explanation})` : ''}`;

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
        }

        // 5. Mark review status as accepted
        ch.pendingReviews = ch.pendingReviews.map((r) =>
          r.id === action.reviewId ? { ...r, status: 'accepted' as const } : r
        );
      }

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
  const { user, manuscript } = useAuth();
  const currentManuscriptId = manuscript?.id || 'default';
  const currentStorageKey = `atelier-manuscrit-v4-${currentManuscriptId}`;

  const [undoState, dispatch] = useReducer(undoableReducer, undefined, () => ({
    past: [],
    present: createInitialState(),
    future: [],
  }));

  const { present: state } = undoState;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload chapters whenever the active manuscript changes
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let targetState: ManuscriptState | null = null;

    // 1. Try local storage: scan all matching keys and pick the state with the highest chapter count
    try {
      const keysToScan: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('atelier-manuscrit')) {
          keysToScan.push(k);
        }
      }
      const explicitKeys = [
        currentStorageKey,
        `atelier-manuscrit-${currentManuscriptId}`,
        'atelier-manuscrit-default',
        'atelier-manuscrit-v1',
      ];
      explicitKeys.forEach((k) => {
        if (!keysToScan.includes(k)) keysToScan.push(k);
      });

      let bestState: ManuscriptState | null = null;
      for (const key of keysToScan) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as ManuscriptState;
            if (parsed.chapters && parsed.chapters.length > 0) {
              if (!bestState) {
                bestState = parsed;
              } else if (parsed.chapters.length > bestState.chapters.length) {
                bestState = parsed;
              } else if (parsed.chapters.length === bestState.chapters.length) {
                const currentSaved = parsed.lastSaved || 0;
                const bestSaved = bestState.lastSaved || 0;
                if (currentSaved >= bestSaved) {
                  bestState = parsed;
                }
              }
            }
          }
        } catch {}
      }

      if (bestState && bestState.chapters.length > 0) {
        const staticChapters = migrateFromStatic();
        const rawChapters = bestState.chapters.map((c, idx) => ({
          ...c,
          notes: c.notes && c.notes.length > 0 ? c.notes : staticChapters[idx]?.notes || [],
        }));
        bestState.chapters = normalizeChapterNotesAndSuperscripts(rawChapters);
        targetState = bestState;
        loaded = true;
      }
    } catch {
      // Ignore
    }

    if (loaded && targetState && !cancelled) {
      dispatch({ type: 'LOAD_STATE', state: targetState });
      try {
        const keysToSync = [
          currentStorageKey,
          `atelier-manuscrit-${currentManuscriptId}`,
          'atelier-manuscrit-default',
          'atelier-manuscrit-v1',
        ];
        const serialized = JSON.stringify(targetState);
        keysToSync.forEach((k) => {
          try { localStorage.setItem(k, serialized); } catch {}
        });
        window.dispatchEvent(
          new CustomEvent('atelier_manuscript_updated', { detail: { manuscriptId: currentManuscriptId } })
        );
      } catch {}
    }

    // 2. Fallback to Firestore if logged in and not yet loaded locally
    if (!loaded && user && manuscript?.id) {
      getChapters(user.uid, manuscript.id)
        .then((fsChapters) => {
          if (cancelled) return;
          if (fsChapters && fsChapters.length > 0) {
            const staticChapters = migrateFromStatic();
            const rawChapters: EditableChapter[] = fsChapters.map((ch, idx) => ({
              id: ch.id || `ch-${idx}`,
              title: ch.title || `Chapitre ${idx + 1}`,
              blocks: (ch.paragraphs || []).map((p) => ({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                content: p,
                type: 'paragraph' as const,
                source: 'original' as const,
                createdAt: Date.now(),
              })),
              notes: (ch as any).notes && (ch as any).notes.length > 0 ? (ch as any).notes : staticChapters[idx]?.notes || [],
              pendingReviews: (ch as any).pendingReviews || [],
            }));

            const editableChapters = normalizeChapterNotesAndSuperscripts(rawChapters);

            const newState: ManuscriptState = {
              chapters: editableChapters,
              activeChapterIndex: 0,
              insertionPoint: null,
              lastSaved: null,
              isDirty: false,
            };
            dispatch({ type: 'LOAD_STATE', state: newState });
            try {
              localStorage.setItem(currentStorageKey, JSON.stringify(newState));
              window.dispatchEvent(
                new CustomEvent('atelier_manuscript_updated', { detail: { manuscriptId: currentManuscriptId } })
              );
            } catch {}
          } else {
            // New manuscript with 0 chapters -> Initialize 1 fresh chapter
            const freshState: ManuscriptState = {
              chapters: [
                {
                  id: 'ch-1',
                  title: 'Chapitre 1',
                  blocks: [
                    {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      content: '',
                      type: 'paragraph',
                      source: 'manual',
                      createdAt: Date.now(),
                    },
                  ],
                  notes: [],
                  pendingReviews: [],
                },
              ],
              activeChapterIndex: 0,
              insertionPoint: null,
              lastSaved: null,
              isDirty: false,
            };
            dispatch({ type: 'LOAD_STATE', state: freshState });
            try {
              localStorage.setItem(currentStorageKey, JSON.stringify(freshState));
              window.dispatchEvent(
                new CustomEvent('atelier_manuscript_updated', { detail: { manuscriptId: currentManuscriptId } })
              );
            } catch {}
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [currentManuscriptId, currentStorageKey, user, manuscript?.id]);

  // Keep a ref to the latest state
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Multi-device / Multi-tab Conflict Listener ──
  const lastCloudSaveTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user || !manuscript?.id) return;
    let unsub: (() => void) | null = null;
    try {
      const db = getDb();
      const mRef = doc(db, 'users', user.uid, 'manuscripts', manuscript.id);
      unsub = onSnapshot(mRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const remoteTime = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
        if (remoteTime > lastCloudSaveTimeRef.current + 5000 && stateRef.current.isDirty) {
          console.warn('[Conflict Warning] Des modifications à distance ont été enregistrées sur un autre appareil.');
          window.dispatchEvent(
            new CustomEvent('atelier_sync_conflict', {
              detail: { manuscriptId: manuscript.id, remoteTime },
            })
          );
        }
      });
    } catch (e) {
      console.warn('Conflict listener setup failed:', e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [user, manuscript?.id]);

  // Auto-save: INSTANT local storage & custom event sync + DEBOUCED Firestore sync
  useEffect(() => {
    if (!state.isDirty) return;

    // 1. Save IMMEDIATELY to localStorage and notify all listeners (Liseuse, etc.)
    try {
      const stateToSave = { ...state, lastSaved: Date.now() };
      const serialized = JSON.stringify(stateToSave);
      const keysToSync = [
        currentStorageKey,
        `atelier-manuscrit-${currentManuscriptId}`,
        'atelier-manuscrit-default',
        'atelier-manuscrit-v1',
      ];
      keysToSync.forEach((k) => {
        try { localStorage.setItem(k, serialized); } catch {}
      });
      window.dispatchEvent(
        new CustomEvent('atelier_manuscript_updated', { detail: { manuscriptId: currentManuscriptId } })
      );
      dispatch({ type: 'MARK_SAVED' });
    } catch {
      // Storage full — ignore
    }

    // 2. Debounced save to Firestore for cloud sync
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (user && manuscript?.id) {
      saveTimerRef.current = setTimeout(() => {
        saveAllChapters(user.uid, manuscript.id, state.chapters).catch((err) =>
          console.error('Firestore save chapters error:', err)
        );
      }, 1000);
    }

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, currentStorageKey, currentManuscriptId, user, manuscript?.id]);

  // Force save on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current.isDirty) {
        try {
          localStorage.setItem(currentStorageKey, JSON.stringify(stateRef.current));
          window.dispatchEvent(
            new CustomEvent('atelier_manuscript_updated', { detail: { manuscriptId: currentManuscriptId } })
          );
        } catch {}
      }
    };
  }, [currentStorageKey, currentManuscriptId]);
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
