/**
 * useDictation Hook
 *
 * Manages the full dictation workflow:
 * 1. Audio recording via MediaRecorder
 * 2. AI transcription & structuring via Gemini (two-stage high-speed pipeline)
 * 3. State management & dynamic progress tracking for the UI with zero race conditions
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioRecorder, type RecorderState } from '@/services/audio/recorder';
import { LiveSpeechRecognizer } from '@/services/audio/liveSpeechRecognizer';
import {
  transcribeAudioToRawText,
  structureTranscriptText,
  blobToBase64,
  normalizeAudioMimeType,
  detectAudioMimeTypeFromBlob,
  toAIStructuredOutput,
} from '@/services/ai/transcription';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { isGeminiConfigured } from '@/services/ai/geminiClient';
import type { AIStructuredOutput, VerificationItem } from '@/types/manuscript';

export type DictationPhase =
  | 'idle'           // Ready to record
  | 'recording'      // Recording audio
  | 'paused'         // Recording paused
  | 'processing'     // Transcribing raw audio (if not already streamed)
  | 'complete'       // Transcription complete & in manuscript
  | 'error';         // Error occurred

export interface DictationState {
  phase: DictationPhase;
  duration: number;
  level: number;
  error: string | null;
  result: AIStructuredOutput | null;
  corrections: VerificationItem[];
  summary: string | null;
  isNewChapter: boolean;
  chapterTitle: string | null;
  firebaseConfigured: boolean;
  statusMessage?: string;
  activeModelName?: string;
  usedModel?: string | null;
  interimText?: string;
  targetBlockId?: string | null;
  isAnalyzingInBackground?: boolean;
}

export function useDictation(currentChapterIndex: number) {
  const [state, setState] = useState<DictationState>({
    phase: 'idle',
    duration: 0,
    level: 0,
    error: null,
    result: null,
    corrections: [],
    summary: null,
    isNewChapter: false,
    chapterTitle: null,
    firebaseConfigured: false,
    statusMessage: undefined,
    activeModelName: undefined,
    usedModel: null,
    interimText: undefined,
    targetBlockId: null,
    isAnalyzingInBackground: false,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const speechRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentDurationRef = useRef<number>(0);
  const activeModeRef = useRef<'live-speech' | 'media-recorder' | null>(null);
  const currentRequestIdRef = useRef<number>(0);

  // Check Firebase config on mount
  useEffect(() => {
    setState((prev) => ({ ...prev, firebaseConfigured: isFirebaseConfigured() }));
  }, []);

  const clearTimers = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      speechRecognizerRef.current?.cancel();
    };
  }, [clearTimers]);

  const handleLiveCompletion = useCallback(
    async (rawText: string, durationSec: number, requestId: number) => {
      clearTimers();
      const trimmed = rawText.trim();

      if (!trimmed || trimmed.length === 0) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: "Aucune parole détectée. Veuillez autoriser le microphone et parler distinctement.",
          statusMessage: undefined,
          isAnalyzingInBackground: false,
        }));
        return;
      }

      // Immediate insertion into manuscript state (pure transcription, no auto AI analysis)
      setState((prev) => ({
        ...prev,
        phase: 'complete',
        duration: durationSec,
        error: null,
        result: {
          jetBrut: trimmed.split('\n\n').filter(Boolean),
          ratures: [],
          corrections: [],
          notes: {},
          floatingNotes: [],
        },
        summary: trimmed.slice(0, 100),
        usedModel: 'web-speech-native',
        isAnalyzingInBackground: false,
        statusMessage: undefined,
      }));
    },
    [clearTimers]
  );

  const startRecording = useCallback(
    async (targetBlockId?: string) => {
      // 1. Security origin verification (HTTPS or localhost required for mobile speech APIs)
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: 'La dictée vocale requiert une connexion sécurisée (HTTPS ou localhost). Veuillez ouvrir l’application via HTTPS.',
        }));
        return;
      }

      clearTimers();
      currentRequestIdRef.current++;
      const requestId = currentRequestIdRef.current;
      currentDurationRef.current = 0;

      // Reset state for new dictation
      setState((prev) => ({
        ...prev,
        phase: 'recording',
        duration: 0,
        level: 0.2,
        interimText: '',
        targetBlockId: targetBlockId || null,
        isAnalyzingInBackground: false,
        error: null,
        statusMessage: undefined,
      }));

      // Mode A: Native Web Speech API (0ms instant streaming wherever supported, including Android & Safari)
      if (LiveSpeechRecognizer.isSupported()) {
        try {
          const liveRecognizer = new LiveSpeechRecognizer(
            (interimText) => {
              setState((prev) => ({
                ...prev,
                interimText,
                level: 0.8,
              }));
            },
            (errMsg) => {
              console.warn('[useDictation] Info reconnaissance vocale locale:', errMsg);
            }
          );
          liveRecognizer.start();
          speechRecognizerRef.current = liveRecognizer;
          activeModeRef.current = 'live-speech';

          durationTimerRef.current = setInterval(() => {
            currentDurationRef.current += 1;
            setState((prev) => ({ ...prev, duration: currentDurationRef.current }));
          }, 1000);

          return;
        } catch (e) {
          console.warn('[useDictation] Échec démarrage reconnaissance locale, repli AudioRecorder:', e);
        }
      }

      // Mode B: AudioRecorder with real-time PCM WAV streaming (Mobile & Universal)
      if (!AudioRecorder.isSupported()) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: 'Votre navigateur ne supporte pas l\'enregistrement audio.',
        }));
        return;
      }

      activeModeRef.current = 'media-recorder';
      let isProgressiveTranscribing = false;
      let latestStreamedText = '';

      const recorder = new AudioRecorder(
        {
          onStateChange: (rs: RecorderState) => {
            setState((prev) => ({
              ...prev,
              duration: rs.duration,
              level: rs.level,
              phase: rs.isPaused ? 'paused' : rs.isRecording ? 'recording' : prev.phase,
              interimText: latestStreamedText || prev.interimText || '',
            }));
          },
          onProgressiveAudio: async (wavBlob: Blob) => {
            if (isProgressiveTranscribing) return;
            if (currentRequestIdRef.current !== requestId) return;

            isProgressiveTranscribing = true;
            try {
              const audioBase64 = await blobToBase64(wavBlob);
              const sttRes = await transcribeAudioToRawText(audioBase64, 'audio/wav');
              if (currentRequestIdRef.current === requestId && sttRes.text) {
                const clean = sttRes.text.trim();
                if (clean) {
                  latestStreamedText = clean;
                  setState((prev) => ({
                    ...prev,
                    interimText: clean,
                    level: 0.85,
                  }));
                }
              }
            } catch (err) {
              console.warn('[useDictation] Transcription progressive en direct (non bloquante):', err);
            } finally {
              isProgressiveTranscribing = false;
            }
          },
          onComplete: async (blob: Blob, duration: number, finalWavBlob?: Blob | null) => {
            if ((!blob || blob.size === 0) && (!finalWavBlob || finalWavBlob.size === 0)) {
              setState((prev) => ({
                ...prev,
                phase: 'error',
                error: "L'enregistrement audio est trop court ou vide. Veuillez autoriser le microphone et parler distinctement.",
                statusMessage: undefined,
                isAnalyzingInBackground: false,
              }));
              return;
            }

            let finalText = latestStreamedText;

            // If no progressive text yet (e.g. short audio < 2s), transcribe full audio
            if (!finalText || finalText.length < 3) {
              setState((prev) => ({
                ...prev,
                phase: 'processing',
                statusMessage: 'Transcription audio finale…',
              }));

              try {
                const targetBlob = finalWavBlob && finalWavBlob.size > 0 ? finalWavBlob : blob;
                const audioBase64 = await blobToBase64(targetBlob);
                const cleanMimeType =
                  finalWavBlob && finalWavBlob.size > 0 ? 'audio/wav' : await detectAudioMimeTypeFromBlob(blob);
                const sttRes = await transcribeAudioToRawText(audioBase64, cleanMimeType);
                finalText = sttRes.text;
              } catch (err) {
                if (!finalText) {
                  setState((prev) => ({
                    ...prev,
                    phase: 'error',
                    error: err instanceof Error ? err.message : 'Erreur pendant la transcription.',
                    statusMessage: undefined,
                    isAnalyzingInBackground: false,
                  }));
                  return;
                }
              }
            }

            await handleLiveCompletion(finalText, duration, requestId);
          },
          onError: (error: string) => {
            setState((prev) => ({
              ...prev,
              phase: 'error',
              error,
              statusMessage: undefined,
              isAnalyzingInBackground: false,
            }));
          },
        },
        150
      );

      recorderRef.current = recorder;
      await recorder.start();
    },
    [clearTimers, handleLiveCompletion]
  );

  const pauseRecording = useCallback(() => {
    if (activeModeRef.current === 'live-speech') {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      speechRecognizerRef.current?.stop();
      setState((prev) => ({ ...prev, phase: 'paused' }));
    } else {
      recorderRef.current?.pause();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (activeModeRef.current === 'live-speech') {
      durationTimerRef.current = setInterval(() => {
        currentDurationRef.current += 1;
        setState((prev) => ({ ...prev, duration: currentDurationRef.current }));
      }, 1000);
      speechRecognizerRef.current?.start();
      setState((prev) => ({ ...prev, phase: 'recording' }));
    } else {
      recorderRef.current?.resume();
    }
  }, []);

  const stopRecording = useCallback(() => {
    const requestId = currentRequestIdRef.current;
    if (activeModeRef.current === 'live-speech') {
      const text = speechRecognizerRef.current?.stop() || '';
      const dur = currentDurationRef.current;
      handleLiveCompletion(text, dur, requestId);
    } else if (activeModeRef.current === 'media-recorder') {
      recorderRef.current?.stop();
    }
  }, [handleLiveCompletion]);

  const cancelRecording = useCallback(() => {
    currentRequestIdRef.current++;
    clearTimers();
    speechRecognizerRef.current?.cancel();
    recorderRef.current?.cancel();
    activeModeRef.current = null;
    setState({
      phase: 'idle',
      duration: 0,
      level: 0,
      error: null,
      result: null,
      corrections: [],
      summary: null,
      isNewChapter: false,
      chapterTitle: null,
      firebaseConfigured: isFirebaseConfigured(),
      statusMessage: undefined,
      activeModelName: undefined,
      usedModel: null,
      interimText: undefined,
      targetBlockId: null,
      isAnalyzingInBackground: false,
    });
  }, [clearTimers]);

  const reset = useCallback(() => {
    currentRequestIdRef.current++;
    clearTimers();
    speechRecognizerRef.current?.cancel();
    recorderRef.current?.cancel();
    activeModeRef.current = null;
    setState({
      phase: 'idle',
      duration: 0,
      level: 0,
      error: null,
      result: null,
      corrections: [],
      summary: null,
      isNewChapter: false,
      chapterTitle: null,
      firebaseConfigured: isFirebaseConfigured(),
      statusMessage: undefined,
      activeModelName: undefined,
      usedModel: null,
      interimText: undefined,
      targetBlockId: null,
      isAnalyzingInBackground: false,
    });
  }, [clearTimers]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    reset,
    formatTime,
  };
}
