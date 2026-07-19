/**
 * useDictation Hook
 *
 * Manages the full dictation workflow:
 * 1. Audio recording via MediaRecorder
 * 2. AI transcription via Gemini
 * 3. State management for the UI
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioRecorder, type RecorderState } from '@/services/audio/recorder';
import { transcribeAudio, toAIStructuredOutput } from '@/services/ai/transcription';
import { isFirebaseConfigured } from '@/services/firebase/config';
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
  });

  const recorderRef = useRef<AudioRecorder | null>(null);

  // Check Firebase config on mount
  useEffect(() => {
    setState((prev) => ({ ...prev, firebaseConfigured: isFirebaseConfigured() }));
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
        setState((prev) => ({
          ...prev,
          phase: 'processing',
          duration,
        }));

        if (!isFirebaseConfigured()) {
          // Demo mode: simulate a result
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              phase: 'complete',
              result: {
                jetBrut: [
                  'Ceci est une démonstration. Configurez Firebase dans .env.local pour activer la transcription IA.',
                  `Durée de l'enregistrement : ${Math.floor(duration / 60)}min ${duration % 60}s.`,
                ],
                ratures: [],
                corrections: [],
                notes: {},
                floatingNotes: [],
              },
              summary: 'Mode démonstration — Firebase non configuré',
            }));
          }, 1500);
          return;
        }

        try {
          const result = await transcribeAudio(blob, {
            currentChapter: currentChapterIndex,
          });

          setState((prev) => ({
            ...prev,
            phase: 'complete',
            result: toAIStructuredOutput(result),
            corrections: result.corrections,
            summary: result.summary,
            isNewChapter: result.isNewChapter,
            chapterTitle: result.chapterTitle,
          }));
        } catch (err) {
          setState((prev) => ({
            ...prev,
            phase: 'error',
            error: err instanceof Error ? err.message : 'Erreur inconnue pendant la transcription.',
          }));
        }
      },
      onError: (error: string) => {
        setState((prev) => ({ ...prev, phase: 'error', error }));
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

  const reset = useCallback(() => {
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
    reset,
    formatTime,
  };
}
