import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import {
  toAIStructuredOutput,
  normalizeAudioMimeType,
  detectAudioMimeType,
  extractTranscriptText,
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

  test('extractTranscriptText reads audioTranscription.text from specialized Gemini models', () => {
    // gemini-3.5-transcribe format
    const transcribeApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                audioTranscription: {
                  text: 'Texte dicté par l écrivain.',
                },
              },
            ],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      text: () => '', // SDK returns empty string on audioTranscription parts
    };

    const text = extractTranscriptText(transcribeApiResponse);
    assert.equal(text, 'Texte dicté par l écrivain.');
  });

  test('extractTranscriptText reads standard part.text and strips reasoning / thought blocks', () => {
    // gemini-3.6-flash format with thinking
    const flashApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '<thought>I am analyzing the audio</thought>Texte transcrit propre.',
              },
            ],
            role: 'model',
          },
        },
      ],
    };

    const text = extractTranscriptText(flashApiResponse);
    assert.equal(text, 'Texte transcrit propre.');
  });

  test('detectAudioMimeType recognizes binary magic bytes accurately', () => {
    // WebM magic bytes: 1A 45 DF A3
    const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]);
    assert.equal(detectAudioMimeType(webmBytes, 'audio/webm'), 'audio/webm');

    // MP4 container: ftyp at offset 4
    const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    assert.equal(detectAudioMimeType(mp4Bytes, 'video/mp4'), 'audio/mp4');

    // WAV: RIFF....WAVE
    const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    assert.equal(detectAudioMimeType(wavBytes, ''), 'audio/wav');
  });
});
