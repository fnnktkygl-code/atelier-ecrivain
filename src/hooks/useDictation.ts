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
    isAnalyzingInBackground: false,
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
  const speechRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRequestIdRef = useRef<number>(0);

  // Check Firebase config on mount
  useEffect(() => {
    setState((prev) => ({ ...prev, firebaseConfigured: isFirebaseConfigured() }));
  }, []);

  // Clean up watchdog timer on unmount
  useEffect(() => {
    return () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      speechRecognizerRef.current?.cancel();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!AudioRecorder.isSupported()) {
      setState((prev) => ({
        ...prev,
        phase: 'error',
        error: 'Votre navigateur ne supporte pas l\'enregistrement audio.',
      }));
      return;
    }

    // Reset interim text
    setState((prev) => ({
      ...prev,
      interimText: '',
      isAnalyzingInBackground: false,
      error: null,
    }));

    // Start native browser live speech recognition for 0ms streaming display
    if (LiveSpeechRecognizer.isSupported()) {
      try {
        const liveRecognizer = new LiveSpeechRecognizer((interimText) => {
          setState((prev) => ({
            ...prev,
            interimText,
          }));
        });
        speechRecognizerRef.current = liveRecognizer;
        liveRecognizer.start();
      } catch (e) {
        console.warn('[useDictation] Impossible de démarrer la reconnaissance locale:', e);
      }
    }

    const recorder = new AudioRecorder({
      onStateChange: (rs: RecorderState) => {
        setState((prev) => ({
          ...prev,
          duration: rs.duration,
          level: rs.level,
          phase: rs.isPaused ? 'paused' : rs.isRecording ? 'recording' : prev.phase,
        }));
      },
      onComplete: async (blob: Blob, duration: number) => {
        const requestId = ++currentRequestIdRef.current;
        const liveCapturedText = speechRecognizerRef.current?.stop() || '';

        // Optimistic Immediate Insertion: if live stream has captured text, display immediately!
        if (liveCapturedText.trim().length > 10) {
          setState((prev) => ({
            ...prev,
            phase: 'complete',
            result: {
              jetBrut: liveCapturedText.trim().split('\n\n').filter(Boolean),
              ratures: [],
              corrections: [],
              notes: {},
              floatingNotes: [],
            },
            summary: liveCapturedText.trim().slice(0, 100),
            isAnalyzingInBackground: true,
            statusMessage: 'Perfectionnement du style & détection des ratures…',
            error: null,
            duration,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            phase: 'processing',
            statusMessage: 'Transcription vocale instantanée…',
            error: null,
            duration,
          }));
        }

        if (!isGeminiConfigured() && !isFirebaseConfigured()) {
          // Demo mode
          setTimeout(() => {
            if (currentRequestIdRef.current !== requestId) return;
            setState((prev) => ({
              ...prev,
              phase: 'complete',
              error: null,
              result: {
                jetBrut: [
                  liveCapturedText.trim() || 'Ceci est une démonstration. Configurez votre clé Google AI Studio dans Profil pour activer la transcription IA.',
                  `Durée de l'enregistrement : ${Math.floor(duration / 60)}min ${duration % 60}s.`,
                ],
                ratures: [],
                corrections: [],
                notes: {},
                floatingNotes: [],
              },
              summary: 'Mode démonstration — Clé Gemini non configurée',
              usedModel: 'demo',
              statusMessage: undefined,
              isAnalyzingInBackground: false,
            }));
          }, 600);
          return;
        }

        // Safety watchdog timer (45s max)
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
        }
        watchdogTimerRef.current = setTimeout(() => {
          if (currentRequestIdRef.current !== requestId) return;
          setState((prev) => {
            if (prev.phase === 'processing') {
              return {
                ...prev,
                phase: 'error',
                error: 'Le délai d’attente pour la transcription a été dépassé.',
                statusMessage: undefined,
                isAnalyzingInBackground: false,
              };
            }
            return {
              ...prev,
              isAnalyzingInBackground: false,
              statusMessage: undefined,
            };
          });
        }, 45000);

        try {
          // Step 1: Fast STT transcription (< 1.5s)
          let rawTranscript = liveCapturedText.trim();
          let sttModelUsed = 'web-speech-native';

          if (!rawTranscript || rawTranscript.length < 10) {
            const audioBase64 = await blobToBase64(blob);
            const cleanMimeType = normalizeAudioMimeType(blob.type || 'audio/webm');
            const sttRes = await transcribeAudioToRawText(audioBase64, cleanMimeType);
            rawTranscript = sttRes.text;
            sttModelUsed = sttRes.modelUsed;
          }

          if (currentRequestIdRef.current !== requestId) return;

          if (!rawTranscript || rawTranscript.trim().length === 0) {
            throw new Error('Aucune voix détectée dans l’enregistrement audio.');
          }

          // Step 1.5: Immediately update state with raw text so user sees it right now!
          setState((prev) => ({
            ...prev,
            phase: 'complete',
            error: null,
            result: {
              jetBrut: rawTranscript.split('\n\n').filter(Boolean),
              ratures: prev.result?.ratures || [],
              corrections: prev.result?.corrections || [],
              notes: prev.result?.notes || {},
              floatingNotes: prev.result?.floatingNotes || [],
            },
            summary: rawTranscript.slice(0, 100),
            usedModel: sttModelUsed,
            isAnalyzingInBackground: true,
            statusMessage: 'Perfectionnement du style & détection des ratures…',
          }));

          // Step 2: Background literary structuring & ratures (non-blocking)
          try {
            const { result: structResult, modelUsed: structModel } = await structureTranscriptText(
              rawTranscript,
              { currentChapter: currentChapterIndex }
            );

            if (currentRequestIdRef.current !== requestId) return;

            if (watchdogTimerRef.current) {
              clearTimeout(watchdogTimerRef.current);
              watchdogTimerRef.current = null;
            }

            setState((prev) => ({
              ...prev,
              phase: 'complete',
              error: null,
              result: toAIStructuredOutput(structResult),
              corrections: structResult.corrections,
              summary: structResult.summary,
              isNewChapter: structResult.isNewChapter,
              chapterTitle: structResult.chapterTitle,
              usedModel: `${sttModelUsed} + ${structModel}`,
              isAnalyzingInBackground: false,
              statusMessage: undefined,
            }));
          } catch (structErr) {
            console.warn('[useDictation] Erreur structuration arrière-plan:', structErr);
            if (currentRequestIdRef.current !== requestId) return;
            setState((prev) => ({
              ...prev,
              isAnalyzingInBackground: false,
              statusMessage: undefined,
            }));
          }
        } catch (err) {
          if (currentRequestIdRef.current !== requestId) return;

          if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }

          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: err instanceof Error ? err.message : 'Erreur pendant la transcription.',
            statusMessage: undefined,
            isAnalyzingInBackground: false,
          }));
        }
      },
      onError: (error: string) => {
        speechRecognizerRef.current?.cancel();
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error,
          statusMessage: undefined,
          isAnalyzingInBackground: false,
        }));
      },
    }, 150); // 150 seconds max duration

    recorderRef.current = recorder;
    await recorder.start();
  }, [currentChapterIndex]);

  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  const stopRecording = useCallback(() => {
    speechRecognizerRef.current?.stop();
    recorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    currentRequestIdRef.current++;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    speechRecognizerRef.current?.cancel();
    recorderRef.current?.cancel();
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
      isAnalyzingInBackground: false,
    });
  }, []);

  const reset = useCallback(() => {
    currentRequestIdRef.current++;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    speechRecognizerRef.current?.cancel();
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
      isAnalyzingInBackground: false,
    });
  }, []);

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
