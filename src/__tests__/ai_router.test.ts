import assert from 'node:assert';
import { test, describe } from 'node:test';
import { getPacificDateString } from '../services/ai-router/quota/resetSchedule';
import { MODEL_REGISTRY } from '../services/ai-router/types/modelRegistry';
import { FEATURE_CHAINS } from '../services/ai-router/types/featureChains';
import { selectModel } from '../services/ai-router/router/selectModel';

describe('AI Router & Quota System (Chantier 1)', () => {
  test('getPacificDateString should format date as YYYY-MM-DD', () => {
    const d = new Date('2026-07-24T02:00:00Z');
    const pac = getPacificDateString(d);
    assert.strictEqual(typeof pac, 'string');
    assert.match(pac, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('MODEL_REGISTRY contains valid definitions for required models', () => {
    const flash36 = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.6-flash');
    assert.ok(flash36);
    assert.strictEqual(flash36.quotas.generation?.rpm, 5);
    assert.strictEqual(flash36.quotas.generation?.rpd, 20);

    const flash25 = MODEL_REGISTRY.find((m) => m.id === 'gemini-2.5-flash');
    assert.ok(flash25);
    assert.strictEqual(flash25.quotas.groundingSearch?.rpd, 1500);
  });

  test('FEATURE_CHAINS defines factcheck with degradeInsteadOfFallback', () => {
    const fc = FEATURE_CHAINS.factcheck;
    assert.ok(fc);
    assert.strictEqual(fc.degradeInsteadOfFallback, true);
    assert.strictEqual(fc.requiredQuotaKind, 'groundingSearch');
  });

  test('selectModel returns a valid model for dictation', async () => {
    const selection = await selectModel('dictation');
    assert.ok(selection.modelId);
    assert.strictEqual(typeof selection.degraded, 'boolean');
  });
});
