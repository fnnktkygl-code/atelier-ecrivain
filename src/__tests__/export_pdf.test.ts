import assert from 'node:assert';
import { test, describe } from 'node:test';
import { linearizeManuscript } from '../features/export/utils/linearizeManuscript';
import { THEME_REGISTRY, getTheme } from '../features/export/themes/registry';

describe('PDF Export Module (Chantier 2)', () => {
  test('linearizeManuscript converts EditableChapters into ProcessedChapters correctly', () => {
    const mockChapters = [
      {
        id: 'ch1',
        title: 'Chapitre Premier',
        blocks: [
          { id: 'b1', content: 'Il était une fois...', type: 'paragraph' as const, createdAt: 100 },
          { id: 'b2', content: 'Dans un royaume lointain.', type: 'paragraph' as const, createdAt: 101 },
        ],
        notes: [],
        pendingReviews: [],
      },
    ];

    const processed = linearizeManuscript(mockChapters);
    assert.strictEqual(processed.length, 1);
    assert.strictEqual(processed[0].title, 'Chapitre Premier');
    assert.strictEqual(processed[0].paragraphs.length, 2);
    assert.strictEqual(processed[0].paragraphs[0], 'Il était une fois...');
  });

  test('THEME_REGISTRY has all 10 editorial themes', () => {
    const keys = Object.keys(THEME_REGISTRY);
    assert.strictEqual(keys.length, 10);
    assert.ok(keys.includes('classique'));
    assert.ok(keys.includes('fantasy'));
    assert.ok(keys.includes('prestige'));
  });

  test('getTheme returns valid theme object with fallback', () => {
    const theme = getTheme('fantasy');
    assert.strictEqual(theme.id, 'fantasy');
    assert.strictEqual(theme.chapterOpening, 'ornament');

    const fallback = getTheme('non-existent' as unknown as Parameters<typeof getTheme>[0]);
    assert.strictEqual(fallback.id, 'classique');
  });
});
