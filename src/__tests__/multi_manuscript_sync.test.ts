import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStoredManuscript, saveManuscriptToStorage, createInitialState, makeBlock } from '../hooks/useManuscript';
import { sanitizeFirestoreObject } from '../services/firebase/firestore';

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
// @ts-ignore
globalThis.localStorage = mockStorage;
// @ts-ignore
globalThis.window = {
  dispatchEvent: () => true,
  localStorage: mockStorage,
};

test('Multi-Manuscript Cloud & Local Isolation', async (t) => {
  await t.test('sanitizeFirestoreObject removes all undefined values recursively', () => {
    const dirty = {
      title: 'Mon Amour',
      blocks: [
        { id: 'b1', content: 'Paragraphe 1', type: 'paragraph', category: undefined, attachedToBlockId: undefined },
      ],
      notes: [
        { id: 'n1', key: 'Note 1', content: 'Note 1', category: 'footnote', attachedToBlockId: undefined },
      ],
      pendingReviews: [
        { id: 'r1', original: 'a', suggestion: 'b', attachedToBlockId: undefined },
      ],
      emptyField: undefined,
      nested: {
        a: 1,
        b: undefined,
      },
    };

    const clean = sanitizeFirestoreObject(dirty);
    assert.equal(clean.emptyField, undefined);
    assert.equal('emptyField' in clean, false);
    assert.equal('b' in clean.nested, false);
    assert.equal('category' in clean.blocks[0], false);
    assert.equal('attachedToBlockId' in clean.notes[0], false);
    assert.equal('attachedToBlockId' in clean.pendingReviews[0], false);
  });

  await t.test('prevents cross-manuscript cache leakage when switching manuscripts', () => {
    const ms1State = createInitialState('ms-book-1');
    ms1State.chapters[0].title = 'Chapitre 1 — Livre 1';
    saveManuscriptToStorage('ms-book-1', ms1State);

    const ms2State = createInitialState('ms-book-2');
    ms2State.chapters = [
      { id: 'ch1', title: 'Ch 1 — Mon Amour', blocks: [{ id: 'b1', content: 'Chapitre 1 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch2', title: 'Ch 2 — Mon Amour', blocks: [{ id: 'b2', content: 'Chapitre 2 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch3', title: 'Ch 3 — Mon Amour', blocks: [{ id: 'b3', content: 'Chapitre 3 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch4', title: 'Ch 4 — Mon Amour', blocks: [{ id: 'b4', content: 'Chapitre 4 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch5', title: 'Ch 5 — Mon Amour', blocks: [{ id: 'b5', content: 'Chapitre 5 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch6', title: 'Ch 6 — Mon Amour', blocks: [{ id: 'b6', content: 'Chapitre 6 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
      { id: 'ch7', title: 'Ch 7 — Mon Amour', blocks: [{ id: 'b7', content: 'Chapitre 7 de Mon Amour', type: 'paragraph', source: 'manual', createdAt: Date.now() }], notes: [], pendingReviews: [] },
    ];
    saveManuscriptToStorage('ms-book-2', ms2State);

    // Load specifically ms-book-1
    const loaded1 = loadStoredManuscript('ms-book-1');
    assert.ok(loaded1);
    assert.equal(loaded1.chapters[0].title, 'Chapitre 1 — Livre 1');

    // Load specifically ms-book-2 (Mon Amour)
    const loaded2 = loadStoredManuscript('ms-book-2');
    assert.ok(loaded2);
    assert.equal(loaded2.chapters.length, 7, 'Mon Amour must retain exactly its 7 chapters without cross-over');
    assert.equal(loaded2.chapters[6].title, 'Ch 7 — Mon Amour');
  });

  await t.test('initial state and freshly loaded states are strictly not dirty', () => {
    const initialState = createInitialState('new-mobile-client');
    assert.equal(initialState.isDirty, false, 'New mobile client must not be marked dirty before user types');
  });

  await t.test('simulates mobile client loading 7 cloud chapters on clean cache without losing chapters', () => {
    // Simulate cleared cache on mobile
    mockStorage.clear();

    // Manuscript "Mon Amour" (ms-mon-amour) has 7 chapters in cloud
    const cloudChapters = [
      { id: 'ch-1', title: 'Ch 1 — Le Renouveau', blocks: [{ id: 'b-1', content: 'Paragraphe 1', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-2', title: 'Ch 2 — L’Aurore', blocks: [{ id: 'b-2', content: 'Paragraphe 2', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-3', title: 'Ch 3 — Les Silences', blocks: [{ id: 'b-3', content: 'Paragraphe 3', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-4', title: 'Ch 4 — L’Écoute', blocks: [{ id: 'b-4', content: 'Paragraphe 4', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-5', title: 'Ch 5 — Le Regard', blocks: [{ id: 'b-5', content: 'Paragraphe 5', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-6', title: 'Ch 6 — L’Union', blocks: [{ id: 'b-6', content: 'Paragraphe 6', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
      { id: 'ch-7', title: 'Ch 7 — Mon Amour', blocks: [{ id: 'b-7', content: 'Paragraphe 7', type: 'paragraph' as const, source: 'manual' as const, createdAt: 100 }], notes: [], pendingReviews: [] },
    ];

    // On mobile load with clean cache:
    const initialMobileState = createInitialState('ms-mon-amour');
    assert.equal(initialMobileState.chapters.length, 1);
    assert.equal(initialMobileState.isDirty, false);

    // When cloud chapters arrive, they populate state and persist to local storage
    const cloudSyncState = {
      ...initialMobileState,
      chapters: cloudChapters,
      lastSaved: Date.now(),
      lastCloudSync: Date.now(),
      saveStatus: 'synced' as const,
    };
    saveManuscriptToStorage('ms-mon-amour', cloudSyncState);

    // Next read from local storage on mobile returns all 7 chapters
    const restoredMobile = loadStoredManuscript('ms-mon-amour');
    assert.ok(restoredMobile);
    assert.equal(restoredMobile.chapters.length, 7);
    assert.equal(restoredMobile.chapters[6].title, 'Ch 7 — Mon Amour');
  });

  await t.test('chapter ordering in memory sorts correctly even when some docs have missing order field', () => {
    const rawDocs = [
      { id: 'ch-3', title: 'Chapitre 3', order: 2 },
      { id: 'ch-1', title: 'Chapitre 1', order: 0 },
      { id: 'ch-2', title: 'Chapitre 2', order: 1 },
      { id: 'ch-legacy', title: 'Chapitre Ancien' }, // Missing order field
    ];

    const sorted = [...rawDocs].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 9999;
      const orderB = typeof b.order === 'number' ? b.order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.id || '').localeCompare(b.id || '');
    });

    assert.equal(sorted[0].id, 'ch-1');
    assert.equal(sorted[1].id, 'ch-2');
    assert.equal(sorted[2].id, 'ch-3');
    assert.equal(sorted[3].id, 'ch-legacy');
  });

  await t.test('cached user and active manuscript persist across mobile page refreshes', async () => {
    const { getCachedUser, setCachedUser, clearCachedUser } = await import('../services/firebase/auth');
    
    // Set user upon sign in
    setCachedUser({
      uid: 'writer-user-123',
      displayName: 'Richard',
      email: 'richard@ecrivain.fr',
    } as any);

    // Verify synchronous retrieval on next load / refresh
    const cached = getCachedUser();
    assert.ok(cached);
    assert.equal(cached.uid, 'writer-user-123');
    assert.equal(cached.displayName, 'Richard');

    // Clean up
    clearCachedUser();
    assert.equal(getCachedUser(), null);
  });
});
