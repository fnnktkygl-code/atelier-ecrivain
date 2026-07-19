'use client';

interface RecordButtonProps {
  phase: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  level: number; // 0-1 audio level
  time: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
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
  onReset,
  error,
}: RecordButtonProps) {
  const isActive = phase === 'recording' || phase === 'paused';
  const ringScale = 1 + level * 0.35;

  return (
    <div className="record-area">
      {/* Audio level ring */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            width: 80 * ringScale,
            height: 80 * ringScale,
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
          if (phase === 'idle' || phase === 'complete' || phase === 'error') {
            if (phase === 'complete' || phase === 'error') onReset();
            onStart();
          } else if (phase === 'recording') {
            onPause();
          } else if (phase === 'paused') {
            onResume();
          }
        }}
        disabled={phase === 'processing'}
        aria-label={
          phase === 'recording'
            ? 'Mettre en pause'
            : phase === 'paused'
            ? 'Reprendre'
            : phase === 'processing'
            ? 'Traitement en cours'
            : 'Commencer à dicter'
        }
        style={phase === 'processing' ? { opacity: 0.5, cursor: 'wait' } : undefined}
      >
        {phase === 'idle' || phase === 'complete' || phase === 'error'
          ? '🎙️'
          : phase === 'recording'
          ? '⏸'
          : phase === 'paused'
          ? '▶️'
          : '⏳'}
      </button>

      {/* Timer */}
      {isActive && <div className="record-timer">{time}</div>}

      {/* Stop button */}
      {isActive && (
        <button
          className="btn btn-primary"
          onClick={onStop}
          style={{ marginTop: 4, fontSize: 13, padding: '8px 20px' }}
        >
          ⏹ Terminer la dictée
        </button>
      )}

      {/* Status text — contextual and pedagogical */}
      <div className={`record-status ${isActive ? 'active' : ''}`}>
        {phase === 'idle' && (
          <span>
            Appuyez sur le micro pour dicter
            <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: .6 }}>
              Parlez naturellement — l&apos;IA détectera vos ratures et reformulations
            </span>
          </span>
        )}
        {phase === 'recording' && (
          <span>
            🔴 Enregistrement en cours…
            <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: .6 }}>
              Parlez librement, hésitez, reprenez-vous — tout est capté
            </span>
          </span>
        )}
        {phase === 'paused' && 'En pause — appuyez ▶️ pour reprendre'}
        {phase === 'processing' && (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
              Gemini analyse votre dictée…
            </span>
            <span style={{ fontSize: 11, opacity: .6 }}>
              Transcription, détection des ratures, vérification des citations
            </span>
          </span>
        )}
        {phase === 'complete' && (
          <span>
            ✅ Transcription terminée
            <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: .6 }}>
              Le texte a été inséré dans l&apos;éditeur. Vérifiez les révisions IA (✂️).
            </span>
          </span>
        )}
        {phase === 'error' && `❌ ${error || 'Erreur'}`}
      </div>
    </div>
  );
}
