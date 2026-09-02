'use client';

import QuotaBadge from '@/components/Shared/QuotaBadge';
import {
  IconMic,
  IconPause,
  IconPlay,
  IconStop,
  IconClose,
  IconCheck,
  IconChevronRight,
} from '@/components/Shared/Icons';

interface RecordButtonProps {
  phase: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  level: number; // 0-1 audio level
  time: string;
  statusMessage?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel?: () => void;
  onReset: () => void;
  error?: string | null;
}

export default function RecordButton({
  phase,
  level,
  time,
  statusMessage,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
  onReset,
  error,
}: RecordButtonProps) {
  const isActive = phase === 'recording' || phase === 'paused';
  const ringScale = 1 + level * 0.35;

  // Idle / Complete / Error — Sleek Compact Bar
  if (!isActive && phase !== 'processing') {
    return (
      <div
        className="record-bar-compact"
        onClick={() => {
          if (phase === 'complete' || phase === 'error') onReset();
          onStart();
        }}
      >
        <div className="record-mic-badge">
          <IconMic size={16} strokeWidth={2} />
        </div>
        <div className="record-text-compact">
          <span className="record-title-compact">
            {phase === 'complete' ? (
              <span className="record-status-success">
                <IconCheck size={13} strokeWidth={2.5} />
                <span>Texte inséré</span>
              </span>
            ) : phase === 'error' ? (
              <span className="record-status-err">
                <IconClose size={13} strokeWidth={2.5} />
                <span>Erreur</span>
              </span>
            ) : (
              'Dictée vocale Gemini'
            )}
          </span>
          <span className="record-sub-compact">
            {phase === 'complete' ? 'Cliquez pour ré-enregistrer' : error || 'Appuyez pour dicter'}
          </span>
        </div>
        <div className="record-controls-compact">
          <button className="record-btn-start-compact" aria-label="Démarrer la dictée">
            <span>Dicter</span>
            <IconChevronRight size={13} strokeWidth={2.5} />
          </button>
          <QuotaBadge />
        </div>
      </div>
    );
  }

  // Active / Processing — Full Recording Mode
  return (
    <div className="record-area active">
      {/* Audio level ring */}
      {isActive && (
        <div
          className="audio-level-ring"
          style={{
            width: 72 * ringScale,
            height: 72 * ringScale,
            opacity: 0.15 + level * 0.4,
          }}
        />
      )}

      {/* Main button */}
      <button
        className={`record-btn ${phase === 'recording' ? 'recording' : ''}`}
        onClick={() => {
          if (phase === 'recording') onPause();
          else if (phase === 'paused') onResume();
        }}
        disabled={phase === 'processing'}
        aria-label={
          phase === 'recording'
            ? 'Mettre en pause'
            : phase === 'paused'
            ? 'Reprendre'
            : 'Traitement en cours'
        }
      >
        {phase === 'recording' ? (
          <IconPause size={20} strokeWidth={2.5} />
        ) : phase === 'paused' ? (
          <IconPlay size={20} strokeWidth={2.5} />
        ) : (
          <span className="processing-spinner mini" />
        )}
      </button>

      {/* Timer */}
      {isActive && <div className="record-timer">{time}</div>}

      {/* Status text */}
      <div className={`record-status ${isActive ? 'active' : ''}`}>
        {phase === 'recording' && <span className="recording-label">Dictée en cours…</span>}
        {phase === 'paused' && <span>En pause — appuyez pour reprendre</span>}
        {phase === 'processing' && (
          <span className="processing-label">
            <span className="processing-spinner" />
            <span>{statusMessage || 'Transcription et structuration en cours…'}</span>
          </span>
        )}
      </div>

      {/* Action buttons (Stop & Cancel) */}
      {isActive && (
        <div className="record-action-row">
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onStop();
            }}
          >
            <IconStop size={13} strokeWidth={2.2} />
            <span>Terminer</span>
          </button>
          {onCancel && (
            <button
              className="btn btn-secondary btn-sm danger-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              title="Annuler l'enregistrement"
            >
              <IconClose size={13} strokeWidth={2.2} />
              <span>Annuler</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
