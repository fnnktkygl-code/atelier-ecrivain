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
}: EditorToolbarProps) {
  const formatSaveTime = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="editor-toolbar">
      {/* Left: Chapter title */}
      <div className="editor-toolbar-left">
        <span className="editor-toolbar-title">{chapterTitle}</span>
      </div>

      {/* Center: Actions */}
      <div className="editor-toolbar-center">
        <Tooltip content="Annuler la dernière action" shortcut="⌘Z">
          <button
            className="btn-icon"
            onClick={onUndo}
            disabled={!canUndo}
            style={{ width: 32, height: 32, fontSize: 14, opacity: canUndo ? 1 : 0.3 }}
          >
            ↩
          </button>
        </Tooltip>
        <Tooltip content="Rétablir l'action annulée" shortcut="⌘⇧Z">
          <button
            className="btn-icon"
            onClick={onRedo}
            disabled={!canRedo}
            style={{ width: 32, height: 32, fontSize: 14, opacity: canRedo ? 1 : 0.3 }}
          >
            ↪
          </button>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        <Tooltip content="Exporter le manuscrit en Markdown (.md)">
          <button
            className="btn-icon"
            onClick={onExport}
            style={{ width: 32, height: 32, fontSize: 14 }}
          >
            📥
          </button>
        </Tooltip>

        <Tooltip content={isFocusMode ? 'Quitter le mode concentration' : 'Mode concentration — masque la sidebar pour écrire sans distraction'}>
          <button
            className={`btn-icon ${isFocusMode ? 'active' : ''}`}
            onClick={onToggleFocus}
            style={{ width: 32, height: 32, fontSize: 14 }}
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
