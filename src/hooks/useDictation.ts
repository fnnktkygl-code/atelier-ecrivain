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
import { transcribeAudio, toAIStructuredOutput } from '@/services/ai/transcription';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { isGeminiConfigured } from '@/services/ai/geminiClient';
import type { AIStructuredOutput, VerificationItem } from '@/types/manuscript';

export type DictationPhase =
  | 'idle'           // Ready to record
  | 'recording'      // Recording audio
  | 'paused'         // Recording paused
  | 'processing'     // Sending to Gemini
  | 'complete'       // Transcription complete
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
  });

  const recorderRef = useRef<AudioRecorder | null>(null);
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

        setState((prev) => ({
          ...prev,
          phase: 'processing',
          statusMessage: 'Initialisation de la transcription…',
          error: null,
          duration,
        }));

        if (!isGeminiConfigured() && !isFirebaseConfigured()) {
          // Demo mode: simulate a result
          setTimeout(() => {
            if (currentRequestIdRef.current !== requestId) return;
            setState((prev) => ({
              ...prev,
              phase: 'complete',
              error: null,
              result: {
                jetBrut: [
                  'Ceci est une démonstration. Configurez votre clé Google AI Studio dans Profil pour activer la transcription IA.',
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
            }));
          }, 1500);
          return;
        }

        // Safety watchdog timer (60s max) to guarantee UI never hangs indefinitely
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
                error: 'Le délai d’attente pour la transcription a été dépassé. Veuillez réessayer avec une dictée plus courte ou vérifier votre connexion.',
                statusMessage: undefined,
              };
            }
            return prev;
          });
        }, 60000);

        try {
          const result = await transcribeAudio(
            blob,
            { currentChapter: currentChapterIndex },
            (progress) => {
              if (currentRequestIdRef.current !== requestId) return;
              setState((prev) => ({
                ...prev,
                statusMessage: progress.message,
                activeModelName: progress.modelName,
              }));
            }
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
            result: toAIStructuredOutput(result),
            corrections: result.corrections,
            summary: result.summary,
            isNewChapter: result.isNewChapter,
            chapterTitle: result.chapterTitle,
            usedModel: result.modelUsed,
            statusMessage: undefined,
          }));
        } catch (err) {
          if (currentRequestIdRef.current !== requestId) return;

          if (watchdogTimerRef.current) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }

          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: err instanceof Error ? err.message : 'Erreur inconnue pendant la transcription.',
            statusMessage: undefined,
          }));
        }
      },
      onError: (error: string) => {
        setState((prev) => ({ ...prev, phase: 'error', error, statusMessage: undefined }));
      },
    });

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
    recorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    currentRequestIdRef.current++;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
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
    });
  }, []);

  const reset = useCallback(() => {
    currentRequestIdRef.current++;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
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
