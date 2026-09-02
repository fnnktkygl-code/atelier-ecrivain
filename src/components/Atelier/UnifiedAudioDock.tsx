/**
 * UnifiedAudioDock — Dock Audio Flottant Unifié (Japandi Minimaliste)
 *
 * Pilule flottante centrée en bas de l'écran affichant la durée d'enregistrement,
 * le streaming en direct de la parole et les contrôles tactiles feutrés.
 */

'use client';

import React from 'react';
import { IconMic, IconPause, IconPlay, IconStop, IconClose, IconSparkles } from '@/components/Shared/Icons';

interface UnifiedAudioDockProps {
  phase: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  duration: number;
  interimText: string;
  formatTime: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export default function UnifiedAudioDock({
  phase,
  duration,
  interimText,
  formatTime,
  onPause,
  onResume,
  onStop,
  onCancel,
}: UnifiedAudioDockProps) {
  if (phase === 'idle') return null;

  return (
    <div className="unified-audio-dock" role="region" aria-label="Enregistrement audio">
      <div className="audio-dock-inner">
        {/* Status Indicator & Timer */}
        <div className="audio-dock-status">
          {phase === 'recording' && (
            <>
              <span className="audio-dock-pulse" />
              <span className="audio-dock-timer">{formatTime(duration)}</span>
              <span className="audio-dock-limit">/ 02:30</span>
            </>
          )}

          {phase === 'paused' && (
            <>
              <span className="audio-dock-dot paused" />
              <span className="audio-dock-label">En pause ({formatTime(duration)})</span>
            </>
          )}

          {phase === 'processing' && (
            <>
              <span className="processing-spinner mini" />
              <span className="audio-dock-label processing">
                <IconSparkles size={13} />
                <span>Structuration & Polissage IA…</span>
              </span>
            </>
          )}
        </div>

        {/* Live Interim Speech Preview */}
        {interimText && phase === 'recording' && (
          <div className="audio-dock-interim" title={interimText}>
            « {interimText.length > 55 ? '…' + interimText.slice(-55) : interimText} »
          </div>
        )}

        {/* Controls */}
        <div className="audio-dock-controls">
          {phase === 'recording' && (
            <button className="btn-dock-action" onClick={onPause} title="Mettre en pause">
              <IconPause size={14} />
            </button>
          )}

          {phase === 'paused' && (
            <button className="btn-dock-action primary" onClick={onResume} title="Reprendre l'enregistrement">
              <IconPlay size={14} />
            </button>
          )}

          {(phase === 'recording' || phase === 'paused') && (
            <>
              <button className="btn-dock-action primary" onClick={onStop} title="Terminer la dictée">
                <IconStop size={14} />
                <span>Terminer</span>
              </button>
              <button className="btn-dock-action ghost danger" onClick={onCancel} title="Annuler sans sauvegarder">
                <IconClose size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
