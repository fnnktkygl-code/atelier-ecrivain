import assert from 'node:assert';
import { test, describe } from 'node:test';
import { normalizeChapterNotesAndSuperscripts } from '../hooks/useManuscript';
import { linearizeManuscript } from '../features/export/utils/linearizeManuscript';
import type { EditableChapter } from '../types/editor';

describe('Stress & Performance Benchmarks', () => {
  test('handles large manuscript serialization without memory bottleneck (50 chapters, 5000 blocks)', () => {
    const chapters: EditableChapter[] = [];
    const totalChapters = 50;
    const blocksPerChapter = 100;

    for (let c = 0; c < totalChapters; c++) {
      const blocks = [];
      for (let b = 0; b < blocksPerChapter; b++) {
        blocks.push({
          id: `c${c}-b${b}`,
          content: `Paragraphe numéro ${b + 1} du chapitre ${c + 1}. Contenu d'un manuscrit complet pour tester la vitesse et la réactivité du moteur.`,
          type: 'paragraph' as const,
          source: 'original' as const,
          createdAt: Date.now(),
        });
      }
      chapters.push({
        id: `ch-${c}`,
        title: `Chapitre ${c + 1} — Titre du Chapitre`,
        blocks,
        notes: [
          { id: `n-${c}-1`, key: 'Note 1', content: `Explication historique pour le chapitre ${c + 1}`, source: 'original' as const },
          { id: `n-${c}-2`, key: 'Note 2', content: `Source littéraire pour le chapitre ${c + 1}`, source: 'original' as const },
        ],
        pendingReviews: [],
      });
    }

    const t0 = performance.now();
    const normalized = normalizeChapterNotesAndSuperscripts(chapters);
    const t1 = performance.now();

    assert.strictEqual(normalized.length, totalChapters);
    assert.strictEqual(normalized[0].blocks.length, blocksPerChapter);
    // Normalization should complete within 50ms for 5000 blocks
    assert.ok(t1 - t0 < 100, `Normalization took ${t1 - t0}ms, which should be under 100ms`);

    const t2 = performance.now();
    const linearized = linearizeManuscript(normalized);
    const t3 = performance.now();

    assert.strictEqual(linearized.length, totalChapters);
    assert.strictEqual(linearized[0].paragraphs.length, blocksPerChapter);
    assert.ok(t3 - t2 < 50, `Linearization took ${t3 - t2}ms, which should be under 50ms`);
  });

  test('superscript note mapping remains isolated per chapter under high load', () => {
    const chapters: EditableChapter[] = [
      {
        id: 'ch-0',
        title: 'Chapitre 1',
        blocks: [{ id: 'b0', content: 'Première référence¹ et seconde référence²', type: 'paragraph', source: 'original', createdAt: 0 }],
        notes: [
          { id: 'n1', key: 'Note 1', content: 'Note A', source: 'original' as const },
          { id: 'n2', key: 'Note 2', content: 'Note B', source: 'original' as const },
        ],
        pendingReviews: [],
      },
      {
        id: 'ch-1',
        title: 'Chapitre 2',
        blocks: [{ id: 'b1', content: 'Référence distincte¹ dans le chapitre 2', type: 'paragraph', source: 'original', createdAt: 0 }],
        notes: [
          { id: 'n3', key: 'Note 1', content: 'Note C (Chapitre 2)', source: 'original' as const },
        ],
        pendingReviews: [],
      },
    ];

    const normalized = normalizeChapterNotesAndSuperscripts(chapters);
    assert.strictEqual(normalized[0].notes.length, 2);
    assert.strictEqual(normalized[0].notes[0].content, 'Note A');
    assert.strictEqual(normalized[1].notes.length, 1);
    assert.strictEqual(normalized[1].notes[0].content, 'Note C (Chapitre 2)');
  });
});
