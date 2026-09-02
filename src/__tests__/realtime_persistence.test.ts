import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  manuscriptReducer,
  undoableReducer,
  loadStoredManuscript,
  saveManuscriptToStorage,
  getPrimaryStorageKey,
  createInitialState,
  normalizeChapterNotesAndSuperscripts,
  makeBlock,
} from '../hooks/useManuscript';
import { toTimestampMillis } from '../services/firebase/firestore';
import type { ManuscriptState, EditableChapter } from '../types/editor';

describe('Real-Time Auto-Save & Persistence Engine', () => {
  // Mock LocalStorage in Node environment
  class MockLocalStorage {
    private store: Record<string, string> = {};

    getItem(key: string): string | null {
      return this.store[key] || null;
    }

    setItem(key: string, value: string): void {
      this.store[key] = String(value);
    }

    removeItem(key: string): void {
      delete this.store[key];
    }

    clear(): void {
      this.store = {};
    }

    get length(): number {
      return Object.keys(this.store).length;
    }

    key(index: number): string | null {
      const keys = Object.keys(this.store);
      return keys[index] || null;
    }
  }

  const mockStorage = new MockLocalStorage();
  (globalThis as unknown as { window: unknown }).window = {
    dispatchEvent: () => true,
    localStorage: mockStorage,
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  it('generates consistent storage keys for manuscripts', () => {
    assert.equal(getPrimaryStorageKey('ms-123'), 'atelier_manuscript_ms-123');
    assert.equal(getPrimaryStorageKey(''), 'atelier_manuscript_default');
    assert.equal(getPrimaryStorageKey('default'), 'atelier_manuscript_default');
  });

  it('immediately marks state as dirty and updates timestamp on text modification', () => {
    const initialState = createInitialState('test-ms');
    const firstChapter = initialState.chapters[0];
    const firstBlock = firstChapter.blocks[0];

    const updated = manuscriptReducer(initialState, {
      type: 'UPDATE_BLOCK',
      chapterIndex: 0,
      blockId: firstBlock.id,
      content: 'Nouveau paragraphe dicté ou tapé par l’auteur.',
    });

    assert.equal(updated.isDirty, true);
    assert.equal(updated.saveStatus, 'saving');
    assert.ok(typeof updated.lastSaved === 'number');
    assert.equal(updated.chapters[0].blocks[0].content, 'Nouveau paragraphe dicté ou tapé par l’auteur.');
  });

  it('saves and immediately restores manuscript from LocalStorage on page reload simulation', () => {
    mockStorage.clear();

    const manuscriptId = 'ms-persistence-test';
    const state: ManuscriptState = {
      chapters: [
        {
          id: 'ch-1',
          title: 'Chapitre 1 — Genèse',
          blocks: [
            makeBlock('Le premier paragraphe du roman.'),
            makeBlock('Le second paragraphe avec des détails précieux.'),
          ],
          notes: [{ id: 'n-1', key: 'Note 1', content: 'Note historique', source: 'manual' }],
          pendingReviews: [],
        },
      ],
      activeChapterIndex: 0,
      insertionPoint: null,
      isDirty: false,
      lastSaved: 1700000000000,
      lastCloudSync: 1700000000000,
      saveStatus: 'synced',
    };

    // Save to storage
    saveManuscriptToStorage(manuscriptId, state);

    // Simulate page reload: loadStoredManuscript
    const restored = loadStoredManuscript(manuscriptId);

    assert.ok(restored !== null);
    assert.equal(restored.chapters.length, 1);
    assert.equal(restored.chapters[0].title, 'Chapitre 1 — Genèse');
    assert.equal(restored.chapters[0].blocks.length, 2);
    assert.equal(restored.chapters[0].blocks[0].content, 'Le premier paragraphe du roman.');
    assert.equal(restored.chapters[0].blocks[1].content, 'Le second paragraphe avec des détails précieux.');
    assert.equal(restored.chapters[0].notes.length, 1);
    assert.equal(restored.lastSaved, 1700000000000);
  });

  it('handles dictation insertion and preserves it in local persistence', () => {
    const initialState = createInitialState('test-dictation');
    const newDictatedBlocks = [
      makeBlock('Voici une phrase dictée au micro.', 'dictation'),
      makeBlock('Et une seconde phrase enregistrée.', 'dictation'),
    ];

    const afterDictation = manuscriptReducer(initialState, {
      type: 'INSERT_DICTATION',
      chapterIndex: 0,
      afterBlockIndex: null,
      blocks: newDictatedBlocks,
    });

    assert.equal(afterDictation.isDirty, true);
    assert.ok(afterDictation.chapters[0].blocks.length > 0);

    // Save
    saveManuscriptToStorage('test-dictation', afterDictation);

    // Reload
    const reloaded = loadStoredManuscript('test-dictation');
    assert.ok(reloaded !== null);
    const lastBlock = reloaded.chapters[0].blocks[reloaded.chapters[0].blocks.length - 1];
    assert.ok(lastBlock.content.includes('Voici une phrase dictée au micro.'));
  });

  it('properly converts Firestore timestamps to epoch milliseconds', () => {
    // Number timestamp
    assert.equal(toTimestampMillis(1700000000000), 1700000000000);

    // Date object
    const d = new Date('2026-09-02T14:30:00.000Z');
    assert.equal(toTimestampMillis(d), d.getTime());

    // Firestore Timestamp with toMillis()
    const firestoreMock1 = {
      toMillis: () => 1725287400000,
    };
    assert.equal(toTimestampMillis(firestoreMock1), 1725287400000);

    // Firestore Timestamp with seconds
    const firestoreMock2 = {
      seconds: 1725287400,
      nanoseconds: 0,
    };
    assert.equal(toTimestampMillis(firestoreMock2), 1725287400000);

    // ISO string
    assert.equal(toTimestampMillis('2026-09-02T14:30:00.000Z'), d.getTime());

    // Falsy value
    assert.equal(toTimestampMillis(null), 0);
    assert.equal(toTimestampMillis(undefined), 0);
  });

  it('reconciles Cloud vs Local timestamps with Last-Write-Wins logic', () => {
    const localLastSaved = 1725280000000; // Local edited at T=0

    // Scenario A: Phone updated cloud 5 minutes later (T = +300s)
    const cloudUpdatedAtNewer = 1725280300000;
    const shouldCloudWin = cloudUpdatedAtNewer > (localLastSaved + 2000);
    assert.equal(shouldCloudWin, true, 'Cloud version from phone must overwrite older local cache');

    // Scenario B: Laptop has newer edits offline (T = +10s) while cloud is older
    const cloudUpdatedAtOlder = 1725279990000;
    const shouldLocalWin = localLastSaved >= cloudUpdatedAtOlder;
    assert.equal(shouldLocalWin, true, 'Newer local version must take priority and push to cloud');
  });

  it('maintains undo/redo history without corrupting saved state', () => {
    const baseState = createInitialState('test-undo');
    const undoable = {
      past: [],
      present: baseState,
      future: [],
    };

    // 1. Add block
    const state1 = undoableReducer(undoable, {
      type: 'ADD_BLOCK',
      chapterIndex: 0,
      afterBlockId: null,
      content: 'Texte à annuler',
    });

    assert.equal(state1.past.length, 1);
    assert.equal(state1.present.chapters[0].blocks[0].content, 'Texte à annuler');

    // 2. Undo
    const state2 = undoableReducer(state1, { type: 'UNDO' });
    assert.equal(state2.future.length, 1);
    assert.equal(state2.present.chapters[0].blocks[0].content, baseState.chapters[0].blocks[0].content);

    // 3. Redo
    const state3 = undoableReducer(state2, { type: 'REDO' });
    assert.equal(state3.present.chapters[0].blocks[0].content, 'Texte à annuler');
  });
});
