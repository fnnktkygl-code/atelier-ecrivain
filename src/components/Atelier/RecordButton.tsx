'use client';

interface RecordButtonProps {
  phase: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  level: number; // 0-1 audio level
  time: string;
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
        title="Démarrer la dictée vocale IA"
      >
        <div className="record-mic-badge">
          🎙️
        </div>
        <div className="record-text-compact">
          <span className="record-title-compact">
            {phase === 'complete' ? '✅ Text inséré' : phase === 'error' ? '❌ Erreur' : 'Dictée vocale IA'}
          </span>
          <span className="record-sub-compact">
            {phase === 'complete' ? 'Cliquez pour ré-enregistrer' : 'Appuyez pour dicter'}
          </span>
        </div>
        <button className="record-btn-start-compact">
          Dicter ➔
        </button>
      </div>
    );
  }

  // Active / Processing — Full Recording Mode
  return (
    <div className="record-area active">
      {/* Audio level ring */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            width: 72 * ringScale,
            height: 72 * ringScale,
            borderRadius: '50%',
            border: `2px solid var(--accent)`,
            opacity: 0.15 + level * 0.4,
            transition: 'all 0.1s ease',
            pointerEvents: 'none',
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
        style={phase === 'processing' ? { opacity: 0.5, cursor: 'wait' } : undefined}
      >
        {phase === 'recording' ? '⏸' : phase === 'paused' ? '▶️' : '⏳'}
      </button>

      {/* Timer */}
      {isActive && <div className="record-timer">{time}</div>}

      {/* Status text */}
      <div className={`record-status ${isActive ? 'active' : ''}`} style={{ fontFamily: 'var(--font-sans)', fontSize: 13, textAlign: 'center' }}>
        {phase === 'recording' && <span style={{ color: '#e53e3e', fontWeight: 600 }}>🔴 Dictée en cours…</span>}
        {phase === 'paused' && <span style={{ fontWeight: 600 }}>En pause — appuyez ▶️ pour reprendre</span>}
        {phase === 'processing' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--accent)' }}>
            <span style={{ animation: 'spin 1s linear infinite' }}>⚙️</span> Gemini analyse…
          </span>
        )}
      </div>

      {/* Action buttons (Stop & Cancel) */}
      {isActive && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); onStop(); }}
            style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            ⏹ Terminer
          </button>
          {onCancel && (
            <button
              className="btn btn-secondary"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                borderColor: '#e53e3e',
                color: '#e53e3e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Annuler l'enregistrement"
            >
              ✕ Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
