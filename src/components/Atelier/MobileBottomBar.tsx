/**
 * MobileBottomBar — Barre d'action tactile inférieure pour mobile (Japandi Minimaliste)
 *
 * Conçue pour une manipulation fluide à une main en situation de mobilité (trajets, marche, attente) :
 * 1. Accès rapide aux chapitres (Ch. X ▾) + Création 1-tap (+ Ch)
 * 2. Bouton central géant de dictée vocale (FAB) avec contrôles d'arrêt immédiat et chronomètre
 * 3. Bouton tactile 1-tap « + Paragraphe » pour ajouter une nouvelle pensée
 * 4. Bouton 1-tap « Annuler » (Undo)
 */

'use client';

import React from 'react';
import type { DictationState } from '@/hooks/useDictation';
import {
  IconMic,
  IconStop,
  IconPause,
  IconPlay,
  IconClose,
  IconPlus,
  IconUndo,
  IconFolder,
  IconSparkles,
  IconChevronRight,
} from '@/components/Shared/Icons';

interface MobileBottomBarProps {
  currentChapterIndex: number;
  chapterCount: number;
  chapterTitle: string;
  onOpenChapters: () => void;
  onAddChapter: () => void;
  onAddParagraph: () => void;
  onUndo: () => void;
  canUndo: boolean;
  dictationState: DictationState;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onPauseDictation: () => void;
  onResumeDictation: () => void;
  onCancelDictation: () => void;
  formatTime: (seconds: number) => string;
}

export default function MobileBottomBar({
  currentChapterIndex,
  chapterCount,
  chapterTitle,
  onOpenChapters,
  onAddChapter,
  onAddParagraph,
  onUndo,
  canUndo,
  dictationState: ds,
  onStartDictation,
  onStopDictation,
  onPauseDictation,
  onResumeDictation,
  onCancelDictation,
  formatTime,
}: MobileBottomBarProps) {
  const isRecording = ds.phase === 'recording';
  const isPaused = ds.phase === 'paused';
  const isProcessing = ds.phase === 'processing';
  const isActiveAudio = isRecording || isPaused || isProcessing;

  const [keyboardOffset, setKeyboardOffset] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisualViewportChange = () => {
      if (window.visualViewport) {
        const vv = window.visualViewport;
        // On mobile browsers, the virtual keyboard pushes the visual viewport up.
        // Offset is the difference between innerHeight and visualViewport bottom.
        const offset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
        setKeyboardOffset(offset);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      window.visualViewport.addEventListener('scroll', handleVisualViewportChange);
    }
    window.addEventListener('resize', handleVisualViewportChange);

    const handleFocusIn = () => {
      setTimeout(handleVisualViewportChange, 50);
      setTimeout(handleVisualViewportChange, 200);
      setTimeout(handleVisualViewportChange, 400);
    };

    const handleFocusOut = () => {
      setTimeout(handleVisualViewportChange, 50);
      setTimeout(handleVisualViewportChange, 200);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportChange);
      }
      window.removeEventListener('resize', handleVisualViewportChange);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <nav
      className={`mobile-bottom-bar ${isActiveAudio ? 'audio-active' : ''} ${keyboardOffset > 50 ? 'keyboard-open' : ''}`}
      style={keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)`, transition: 'transform 0.12s ease-out' } : undefined}
      aria-label="Commandes rapides mobile"
    >
      <div className="mobile-bottom-bar-inner">
        {/* ── MODE AUDIO ACTIF : Contrôles d'enregistrement prioritaires ── */}
        {isActiveAudio ? (
          <div className="mobile-audio-active-dock">
            {/* Statut & Chronomètre */}
            <div className="mobile-audio-info">
              {isRecording && (
                <>
                  <span className="mobile-audio-pulse" />
                  <div className="mobile-audio-time-group">
                    <span className="mobile-audio-timer">{formatTime(ds.duration)}</span>
                    <span className="mobile-audio-limit">/ 02:30</span>
                  </div>
                </>
              )}
              {isPaused && (
                <div className="mobile-audio-time-group">
                  <span className="mobile-audio-badge-paused">En pause</span>
                  <span className="mobile-audio-timer muted">{formatTime(ds.duration)}</span>
                </div>
              )}
              {isProcessing && (
                <div className="mobile-audio-processing">
                  <span className="processing-spinner mini" />
                  <span className="mobile-audio-proc-text">L&apos;IA structure vos paroles…</span>
                </div>
              )}
            </div>


            {/* Boutons d'action audio adaptés au pouce */}
            <div className="mobile-audio-actions">
              {isRecording && (
                <button
                  className="mobile-btn-audio pause"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={onPauseDictation}
                  title="Mettre en pause"
                  aria-label="Pause"
                >
                  <IconPause size={18} strokeWidth={2.2} />
                </button>
              )}

              {isPaused && (
                <button
                  className="mobile-btn-audio resume"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={onResumeDictation}
                  title="Reprendre"
                  aria-label="Reprendre"
                >
                  <IconPlay size={18} strokeWidth={2.2} />
                </button>
              )}

              {(isRecording || isPaused) && (
                <>
                  <button
                    className="mobile-btn-audio stop-primary"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onStopDictation}
                    title="Terminer et insérer dans le texte"
                    aria-label="Terminer la dictée"
                  >
                    <IconStop size={18} strokeWidth={2.5} />
                    <span>Terminer</span>
                  </button>

                  <button
                    className="mobile-btn-audio cancel"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={onCancelDictation}
                    title="Annuler l'enregistrement"
                    aria-label="Annuler"
                  >
                    <IconClose size={18} strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── MODE NAVIGATION / ÉDITION NORMALE ── */
          <div className="mobile-nav-dock">
            {/* 1. Sélecteur Chapitre Rapide */}
            <div className="mobile-chapter-group">
              <button
                className="mobile-btn-chapter"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onOpenChapters}
                title={`Chapitres (${chapterCount})`}
                aria-label="Ouvrir la liste des chapitres"
              >
                <IconFolder size={15} strokeWidth={2} />
                <span className="mobile-ch-label">Chapitre {currentChapterIndex + 1}</span>
                <IconChevronRight size={13} className="rotate-90 text-soft" />
              </button>

              <button
                className="mobile-btn-add-ch"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onAddChapter}
                title="Ajouter un nouveau chapitre"
                aria-label="Nouveau chapitre"
              >
                <IconPlus size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* 2. Grand Bouton Dictée Central (FAB) */}
            <div className="mobile-fab-dictation-wrap">
              <button
                type="button"
                className="mobile-fab-dictation"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onStartDictation}
                title="Dicter une pensée (Dictée vocale par IA)"
                aria-label="Lancer la dictée vocale"
              >
                <span className="mobile-fab-glow" />
                <IconMic size={24} strokeWidth={2} className="mobile-fab-icon" />
                <span className="mobile-fab-label">Dicter</span>
              </button>
            </div>

            {/* 3. Boutons Droite : Nouveau Paragraphe & Undo */}
            <div className="mobile-actions-group">
              <button
                className="mobile-btn-add-paragraph"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onAddParagraph}
                title="Insérer un nouveau paragraphe"
                aria-label="Nouveau paragraphe"
              >
                <IconPlus size={15} strokeWidth={2.2} />
                <span>Bloc</span>
              </button>

              <button
                className="mobile-btn-undo"
                onPointerDown={(e) => e.preventDefault()}
                onClick={onUndo}
                disabled={!canUndo}
                title="Annuler la dernière modification"
                aria-label="Annuler"
              >
                <IconUndo size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
