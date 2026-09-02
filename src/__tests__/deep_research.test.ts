import assert from 'node:assert';
import { test, describe } from 'node:test';
import { MODEL_REGISTRY } from '../services/ai-router/types/modelRegistry';
import { FEATURE_CHAINS } from '../services/ai-router/types/featureChains';
import { selectModel } from '../services/ai-router/router/selectModel';

describe('Deep Research & Autonomous Agent Models (Google 2026)', () => {
  test('MODEL_REGISTRY includes official Deep Research and Antigravity models', () => {
    const max = MODEL_REGISTRY.find((m) => m.id === 'deep-research-max-preview-04-2026');
    assert.ok(max, 'Deep Research Max should be registered');
    assert.ok(max.capabilities.includes('research'));

    const preview = MODEL_REGISTRY.find((m) => m.id === 'deep-research-preview-04-2026');
    assert.ok(preview, 'Deep Research Preview should be registered');
    assert.ok(preview.capabilities.includes('research'));

    const agy = MODEL_REGISTRY.find((m) => m.id === 'antigravity-preview-05-2026');
    assert.ok(agy, 'Antigravity Preview should be registered');
    assert.ok(agy.capabilities.includes('research'));
  });

  test('FEATURE_CHAINS deep-research chain is configured with proper fallback sequence', () => {
    const chain = FEATURE_CHAINS['deep-research'].chain;
    assert.strictEqual(chain[0], 'deep-research-max-preview-04-2026');
    assert.strictEqual(chain[1], 'deep-research-preview-04-2026');
    assert.ok(chain.includes('gemini-3.7-flash'));
  });

  test('selectModel selects deep-research model properly', async () => {
    const selection = await selectModel('deep-research');
    assert.strictEqual(selection.modelId, 'deep-research-max-preview-04-2026');
    assert.strictEqual(selection.degraded, false);
  });
});
