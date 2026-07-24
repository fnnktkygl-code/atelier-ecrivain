/**
 * EditorToolbar — Rich toolbar above the editor
 *
 * Features:
 * - Chapter title display
 * - Word count (chapter + total)
 * - Undo / Redo buttons with tooltips
 * - Export Markdown
 * - Save indicator
 * - Review & Notes panel toggles
 * - Focus mode toggle
 */

'use client';

import Tooltip from '@/components/Shared/Tooltip';

interface EditorToolbarProps {
  chapterTitle: string;
  wordCount: number;
  totalWordCount: number;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  lastSaved: number | null;
  pendingReviewCount: number;
  noteCount: number;
  isReviewOpen: boolean;
  isNotesOpen: boolean;
  isFocusMode: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onToggleReview: () => void;
  onToggleNotes: () => void;
  onToggleFocus: () => void;
  onStartDictation?: () => void;
  dictationPhase?: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  onToggleSidebar?: () => void;
  isSpeechPlaying?: boolean;
  isSpeechPaused?: boolean;
  onToggleSpeech?: () => void;
  onStopSpeech?: () => void;
  onExportPdf?: () => void;
}

export default function EditorToolbar({
  chapterTitle,
  wordCount,
  totalWordCount,
  canUndo,
  canRedo,
  isDirty,
  lastSaved,
  pendingReviewCount,
  noteCount,
  isReviewOpen,
  isNotesOpen,
  isFocusMode,
  onUndo,
  onRedo,
  onExport,
  onToggleReview,
  onToggleNotes,
  onToggleFocus,
  onStartDictation,
  dictationPhase = 'idle',
  onToggleSidebar,
  isSpeechPlaying = false,
  isSpeechPaused = false,
  onToggleSpeech,
  onStopSpeech,
  onExportPdf,
}: EditorToolbarProps) {
  const formatSaveTime = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="editor-toolbar">
      {/* Left: Chapter title */}
      <div className="editor-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onToggleSidebar && (
          <button
            className="chapter-drawer-toggle-btn mobile-only-toggle"
            onClick={onToggleSidebar}
            title="Afficher les chapitres"
          >
            <span style={{ fontSize: 16 }}>📑</span>
            <span className="toggle-btn-label">Chapitres</span>
          </button>
        )}
        <span className="editor-toolbar-title">{chapterTitle}</span>
      </div>

      {/* Center: Actions */}
      <div className="editor-toolbar-center">
        {onStartDictation && (
          <>
            <Tooltip content="Dicter un passage (Audio)" shortcut="🎙️">
              <button
                className="btn-icon"
                onClick={onStartDictation}
                disabled={dictationPhase !== 'idle' && dictationPhase !== 'complete' && dictationPhase !== 'error'}
                style={{
                  width: 36, height: 36, fontSize: 17,
                  color: (dictationPhase === 'recording' || dictationPhase === 'processing') ? 'var(--accent)' : 'var(--text)',
                  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%',
                  animation: dictationPhase === 'recording' ? 'pulse 2s infinite' : 'none',
                }}
              >
                {dictationPhase === 'recording' || dictationPhase === 'processing' ? '🔴' : '🎙️'}
              </button>
            </Tooltip>
            <div className="editor-toolbar-divider" />
          </>
        )}

        <Tooltip content="Annuler la dernière action" shortcut="⌘Z">
          <button
            className="btn-icon"
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              width: 36, height: 36, fontSize: 16, fontWeight: 700,
              color: canUndo ? 'var(--text)' : 'var(--text-soft)',
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%',
              opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed'
            }}
          >
            ↩
          </button>
        </Tooltip>
        <Tooltip content="Rétablir l'action annulée" shortcut="⌘⇧Z">
          <button
            className="btn-icon"
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              width: 36, height: 36, fontSize: 16, fontWeight: 700,
              color: canRedo ? 'var(--text)' : 'var(--text-soft)',
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%',
              opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed'
            }}
          >
            ↪
          </button>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        <Tooltip content="Exporter le manuscrit en Markdown (.md)">
          <button
            className="btn-icon"
            onClick={onExport}
            style={{
              width: 36, height: 36, fontSize: 16, color: 'var(--text)',
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%'
            }}
          >
            📥
          </button>
        </Tooltip>

        <Tooltip content="Exporter mon livre en PDF Éditorial (Couverture, Thèmes, Pagination)">
          <button
            className="btn-icon"
            onClick={onExportPdf || onExport}
            style={{
              width: 36, height: 36, fontSize: 16, color: 'var(--accent)',
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%'
            }}
          >
            📖
          </button>
        </Tooltip>

        {onToggleSpeech && (
          <Tooltip content={isSpeechPlaying ? (isSpeechPaused ? 'Reprendre la lecture audio' : 'Mettre en pause la lecture') : 'Écouter le chapitre (Lecture audio)'}>
            <button
              className={`btn-icon ${isSpeechPlaying ? 'active' : ''}`}
              onClick={onToggleSpeech}
              style={{
                width: 36, height: 36, fontSize: 16,
                color: isSpeechPlaying ? 'var(--accent)' : 'var(--text)',
                background: isSpeechPlaying ? 'var(--accent-glow)' : 'var(--surface-2)',
                border: isSpeechPlaying ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '50%',
              }}
            >
              {isSpeechPlaying ? (isSpeechPaused ? '▶️' : '⏸️') : '🔊'}
            </button>
          </Tooltip>
        )}
        {isSpeechPlaying && onStopSpeech && (
          <Tooltip content="Arrêter la lecture audio">
            <button
              className="btn-icon"
              onClick={onStopSpeech}
              style={{
                width: 36, height: 36, fontSize: 16, color: 'var(--danger, #ef4444)',
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '50%',
              }}
            >
              ⏹️
            </button>
          </Tooltip>
        )}

        <Tooltip content={isFocusMode ? 'Quitter le mode concentration' : 'Mode concentration — masque la sidebar pour écrire sans distraction'}>
          <button
            className={`btn-icon ${isFocusMode ? 'active' : ''}`}
            onClick={onToggleFocus}
            style={{
              width: 36, height: 36, fontSize: 16, color: 'var(--text)',
              background: isFocusMode ? 'var(--accent-glow)' : 'var(--surface-2)',
              border: isFocusMode ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: '50%'
            }}
          >
            🎯
          </button>
        </Tooltip>
      </div>

      {/* Right: Panels + Stats */}
      <div className="editor-toolbar-right">
        {/* Save indicator */}
        <span className="editor-save-indicator">
          {isDirty ? (
            <span style={{ color: 'var(--accent)' }}>⟳ Modification...</span>
          ) : lastSaved ? (
            <span style={{ color: 'var(--text-soft)' }}>✓ {formatSaveTime(lastSaved)}</span>
          ) : null}
        </span>

        {/* Word count */}
        <Tooltip content={`Total manuscrit : ${totalWordCount.toLocaleString('fr-FR')} mots`}>
          <span className="editor-word-count">
            {wordCount} mots
          </span>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        {/* Review toggle */}
        <Tooltip content={isReviewOpen ? 'Fermer les révisions IA' : 'Révisions IA — corrections, ratures et suggestions de Gemini'}>
          <button
            className={`btn-icon ${isReviewOpen ? 'active' : ''}`}
            onClick={onToggleReview}
            style={{ width: 32, height: 32, fontSize: 14, position: 'relative' }}
          >
            ✂️
            {pendingReviewCount > 0 && (
              <span className="toolbar-badge">{pendingReviewCount}</span>
            )}
          </button>
        </Tooltip>

        {/* Notes toggle */}
        <Tooltip content={isNotesOpen ? 'Fermer les notes' : 'Notes — annotations et mémos sur ce chapitre'}>
          <button
            className={`btn-icon ${isNotesOpen ? 'active' : ''}`}
            onClick={onToggleNotes}
            style={{ width: 32, height: 32, fontSize: 14, position: 'relative' }}
          >
            📎
            {noteCount > 0 && (
              <span className="toolbar-badge">{noteCount}</span>
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
