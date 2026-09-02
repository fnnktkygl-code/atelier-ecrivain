import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import {
  toAIStructuredOutput,
  normalizeAudioMimeType,
  markModelUnavailable,
  isModelUnavailable,
  resetUnavailableModels,
  type TranscriptionResult,
} from '../services/ai/transcription';
import { clearModelCooldown, loadModelQuota, recordModelUsage } from '../services/ai-router/quota/quotaStore';
import { FEATURE_CHAINS } from '../services/ai-router/types/featureChains';

describe('Dictation Pipeline & Fallback System', () => {
  test('FEATURE_CHAINS dictation prioritizes gemini-3.5-transcribe for audio and text-analysis for gemini-3.6-flash', () => {
    assert.equal(FEATURE_CHAINS.dictation.chain[0], 'gemini-3.5-transcribe');
    assert.equal(FEATURE_CHAINS['text-analysis'].chain[0], 'gemini-3.6-flash');
    assert.ok(FEATURE_CHAINS.dictation.chain.includes('gemini-3.6-flash'));
  });

  test('normalizeAudioMimeType cleans complex browser MIME types', () => {
    assert.equal(normalizeAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
    assert.equal(normalizeAudioMimeType('audio/webm;codecs="opus,vorbis"'), 'audio/webm');
    assert.equal(normalizeAudioMimeType('audio/mp4;codecs=mp4a.40.2'), 'audio/mp4');
    assert.equal(normalizeAudioMimeType('audio/ogg;codecs=opus'), 'audio/ogg');
    assert.equal(normalizeAudioMimeType('audio/wav'), 'audio/wav');
    assert.equal(normalizeAudioMimeType(''), 'audio/webm');
  });

  test('unavailable models cache marks and resets models properly', () => {
    resetUnavailableModels();
    assert.equal(isModelUnavailable('gemini-3.5-transcribe'), false);

    markModelUnavailable('gemini-3.5-transcribe');
    assert.equal(isModelUnavailable('gemini-3.5-transcribe'), true);

    resetUnavailableModels();
    assert.equal(isModelUnavailable('gemini-3.5-transcribe'), false);
  });

  test('toAIStructuredOutput transforms TranscriptionResult correctly', () => {
    const rawResult: TranscriptionResult = {
      chapterIndex: 0,
      chapterTitle: 'Chapitre Premier',
      isNewChapter: false,
      jetBrut: ['Premier paragraphe dicté.', 'Deuxième paragraphe.'],
      ratures: [
        {
          original: 'calibres',
          corrected: 'califes',
          explanation: 'Correction phonétique',
          uncertainty: 'low',
        },
      ],
      corrections: [
        {
          text: 'Citation sourate Al-Baqara verset 255',
          status: 'confirmed',
          source: 'Coran 2:255',
        },
      ],
      notes: { '1': 'Ayat al-Kursi' },
      floatingNotes: ['Penser à développer la conclusion'],
      summary: 'Dictée du premier chapitre',
      modelUsed: 'gemini-3.5-transcribe + gemini-3.7-flash',
    };

    const structured = toAIStructuredOutput(rawResult);
    assert.equal(structured.jetBrut.length, 2);
    assert.equal(structured.jetBrut[0], 'Premier paragraphe dicté.');
    assert.equal(structured.ratures.length, 1);
    assert.match(structured.ratures[0], /\*\*calibres\*\* → califes/);
    assert.equal(structured.corrections.length, 1);
    assert.equal(structured.notes['1'], 'Ayat al-Kursi');
    assert.equal(structured.floatingNotes[0], 'Penser à développer la conclusion');
  });

  test('clearModelCooldown properly removes cooldown state', async () => {
    // Record quota error to trigger cooldown
    await recordModelUsage('gemini-3.5-transcribe', 'generation', 'quota-error');
    const quotaAfterError = loadModelQuota('gemini-3.5-transcribe', 'generation');
    assert.ok(quotaAfterError.cooldownUntilPacificDate);

    // Clear cooldown
    clearModelCooldown('gemini-3.5-transcribe', 'generation');
    const quotaAfterClear = loadModelQuota('gemini-3.5-transcribe', 'generation');
    assert.equal(quotaAfterClear.cooldownUntilPacificDate, undefined);
  });
});
