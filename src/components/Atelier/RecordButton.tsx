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
  duration?: number;
  maxDuration?: number;
  statusMessage?: string;
  isAnalyzingInBackground?: boolean;
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
  duration = 0,
  maxDuration = 150,
  statusMessage,
  isAnalyzingInBackground = false,
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
  const progressRatio = maxDuration > 0 ? Math.min(1, duration / maxDuration) : 0;
  const isNearLimit = duration >= 120;

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
            {isAnalyzingInBackground ? (
              <span className="record-status-processing" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)' }}>
                <span className="processing-spinner mini" style={{ width: 11, height: 11 }} />
                <span>Perfectionnement stylistique…</span>
              </span>
            ) : phase === 'complete' ? (
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
              'Dictée vocale instantanée'
            )}
          </span>
          <span className="record-sub-compact">
            {isAnalyzingInBackground
              ? 'Gemini 3.7 analyse les ratures en arrière-plan'
              : phase === 'complete'
              ? 'Cliquez pour dicter la suite'
              : error || 'Appuyez pour dicter (max 2min30)'}
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

      {/* Timer with progress limit */}
      {isActive && (
        <div className="record-timer" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{time}</span>
          <span style={{ fontSize: 11, color: isNearLimit ? 'var(--japandi-terracotta)' : 'var(--text-soft)', fontWeight: 500 }}>
            / 02:30
          </span>
        </div>
      )}

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
