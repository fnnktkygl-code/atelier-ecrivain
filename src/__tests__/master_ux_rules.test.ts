import test from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptReducer, createInitialState } from '../hooks/useManuscript';
import type { ManuscriptState, PendingReview } from '../types/editor';

test('Master UX & Chapter Limits', async (t) => {
  await t.test('strictly caps active pending reviews to 15 per chapter', () => {
    const state = createInitialState('test-rules');
    const reviews: PendingReview[] = Array.from({ length: 25 }, (_, i) => ({
      id: `rev-${i}`,
      type: 'rature',
      original: `mot${i}`,
      suggestion: `terme${i}`,
      status: 'pending',
    }));

    const nextState = manuscriptReducer(state, {
      type: 'ADD_REVIEWS',
      chapterIndex: 0,
      reviews,
    });

    const activePending = nextState.chapters[0].pendingReviews.filter((r) => r.status === 'pending');
    assert.equal(activePending.length, 15, 'Should cap active pending reviews to 15 max');
  });

  await t.test('APPLY_ALL_REVIEWS applies all pending replacements and marks all as accepted', () => {
    let state = createInitialState('test-batch');
    state.chapters[0].blocks = [
      { id: 'b1', content: 'Il marcha vite dans la rue.', type: 'paragraph', source: 'manual', createdAt: Date.now() },
    ];
    state.chapters[0].pendingReviews = [
      { id: 'r1', type: 'rature', original: 'marcha vite', suggestion: 'se hâta', status: 'pending' },
    ];

    const nextState = manuscriptReducer(state, {
      type: 'APPLY_ALL_REVIEWS',
      chapterIndex: 0,
    });

    assert.equal(nextState.chapters[0].blocks[0].content, 'Il se hâta dans la rue.');
    assert.equal(nextState.chapters[0].pendingReviews[0].status, 'accepted');
  });

  await t.test('REJECT_ALL_REVIEWS marks all pending reviews as rejected without modifying text', () => {
    let state = createInitialState('test-batch-reject');
    state.chapters[0].blocks = [
      { id: 'b1', content: 'Mon style brut.', type: 'paragraph', source: 'manual', createdAt: Date.now() },
    ];
    state.chapters[0].pendingReviews = [
      { id: 'r1', type: 'rature', original: 'style brut', suggestion: 'style poli', status: 'pending' },
    ];

    const nextState = manuscriptReducer(state, {
      type: 'REJECT_ALL_REVIEWS',
      chapterIndex: 0,
    });

    assert.equal(nextState.chapters[0].blocks[0].content, 'Mon style brut.');
    assert.equal(nextState.chapters[0].pendingReviews[0].status, 'rejected');
  });

  await t.test('isolates footnote notes from margin notes in chapter', () => {
    let state = createInitialState('test-notes-cat');
    const initialFootnotes = state.chapters[0].notes.filter((n) => n.category !== 'margin').length;
    state = manuscriptReducer(state, {
      type: 'ADD_NOTE',
      chapterIndex: 0,
      content: 'Nouvelle note de bas de page',
      category: 'footnote',
    });
    state = manuscriptReducer(state, {
      type: 'ADD_NOTE',
      chapterIndex: 0,
      content: 'Pense-bête idée',
      category: 'margin',
    });

    const footnotes = state.chapters[0].notes.filter((n) => n.category !== 'margin');
    const margin = state.chapters[0].notes.filter((n) => n.category === 'margin');

    assert.equal(footnotes.length, initialFootnotes + 1);
    assert.equal(footnotes[footnotes.length - 1].key, `Note ${initialFootnotes + 1}`);
    assert.equal(margin.length, 1);
    assert.equal(margin[0].key, 'Pense-bête');
  });
});
