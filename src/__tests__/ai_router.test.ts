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

  test('MODEL_REGISTRY contains valid definitions for all specialized Google 2026 models', () => {
    // 1. Audio Transcribe
    const transcribe = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.5-transcribe');
    assert.ok(transcribe);
    assert.ok(transcribe.capabilities.includes('transcribe'));

    const transcribeLive = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.5-transcribe-live');
    assert.ok(transcribeLive);
    assert.ok(transcribeLive.capabilities.includes('transcribe-live'));

    // 2. Text & Reasoning
    const flash37 = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.7-flash');
    assert.ok(flash37);
    assert.strictEqual(flash37.quotas.generation?.rpm, 15);

    const pro31 = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.1-pro');
    assert.ok(pro31);
    assert.strictEqual(pro31.quotas.generation?.rpm, 5);

    // 3. TTS & Images
    const tts31 = MODEL_REGISTRY.find((m) => m.id === 'gemini-3.1-flash-tts');
    assert.ok(tts31);
    assert.ok(tts31.capabilities.includes('tts'));

    const nanoBananaPro = MODEL_REGISTRY.find((m) => m.id === 'nano-banana-pro');
    assert.ok(nanoBananaPro);
    assert.ok(nanoBananaPro.capabilities.includes('image'));
  });

  test('FEATURE_CHAINS maps optimal specialized models for each task', () => {
    assert.strictEqual(FEATURE_CHAINS.dictation.chain[0], 'gemini-3.5-transcribe');
    assert.strictEqual(FEATURE_CHAINS['dictation-live'].chain[0], 'gemini-3.5-transcribe-live');
    assert.strictEqual(FEATURE_CHAINS['text-analysis'].chain[0], 'gemini-3.6-flash');
    assert.strictEqual(FEATURE_CHAINS['cover-generation'].chain[0], 'nano-banana-pro');
    assert.strictEqual(FEATURE_CHAINS['global-analysis'].chain[0], 'deep-research-max-preview-04-2026');
    assert.strictEqual(FEATURE_CHAINS['deep-research'].chain[0], 'deep-research-max-preview-04-2026');
  });

  test('selectModel returns specialized models for each feature', async () => {
    const dictation = await selectModel('dictation');
    assert.strictEqual(dictation.modelId, 'gemini-3.5-transcribe');

    const textAnalysis = await selectModel('text-analysis');
    assert.strictEqual(textAnalysis.modelId, 'gemini-3.6-flash');

    const deepResearch = await selectModel('deep-research');
    assert.strictEqual(deepResearch.modelId, 'deep-research-max-preview-04-2026');

    const cover = await selectModel('cover-generation');
    assert.strictEqual(cover.modelId, 'nano-banana-pro');
  });
});
