/**
 * EditorToolbar — Barre d'outils d'écriture Japandi Minimaliste
 *
 * Fonctionnalités :
 * - Titre du chapitre avec bouton tiroir mobile
 * - Dictée vocale & Analyse IA textuelle
 * - Annuler / Rétablir (Undo/Redo)
 * - Export Markdown & Export PDF Éditorial
 * - Lecture audio (TTS)
 * - Mode concentration (Focus mode)
 * - Compteur de mots et badges de révisions / notes
 */

'use client';

import Tooltip from '@/components/Shared/Tooltip';
import {
  IconMic,
  IconSparkles,
  IconUndo,
  IconRedo,
  IconDownload,
  IconBook,
  IconVolume,
  IconPause,
  IconPlay,
  IconStop,
  IconTarget,
  IconScissors,
  IconPaperclip,
  IconFolder,
  IconCheck,
} from '@/components/Shared/Icons';

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
  onAnalyzeText?: () => void;
  isAnalyzingText?: boolean;
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
  onAnalyzeText,
  isAnalyzingText = false,
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

  const isRecording = dictationPhase === 'recording' || dictationPhase === 'processing';

  return (
    <div className="editor-toolbar">
      {/* Left: Chapter title & Mobile sidebar toggle */}
      <div className="editor-toolbar-left">
        {onToggleSidebar && (
          <button
            className="chapter-drawer-toggle-btn mobile-only-toggle"
            onClick={onToggleSidebar}
            title="Afficher les chapitres"
            aria-label="Afficher la liste des chapitres"
          >
            <IconFolder size={16} strokeWidth={2} />
            <span className="toggle-btn-label">Chapitres</span>
          </button>
        )}
        <span className="editor-toolbar-title">{chapterTitle}</span>
      </div>

      {/* Center: Actions */}
      <div className="editor-toolbar-center">
        {onStartDictation && (
          <>
            <Tooltip content="Dicter un passage (Audio)" shortcut="⌘D">
              <button
                className={`btn-icon ${isRecording ? 'recording-active' : ''}`}
                onClick={onStartDictation}
                disabled={dictationPhase !== 'idle' && dictationPhase !== 'complete' && dictationPhase !== 'error'}
                aria-label="Démarrer la dictée vocale"
              >
                <IconMic size={17} strokeWidth={2} />
              </button>
            </Tooltip>
            {onAnalyzeText && (
              <Tooltip content="Analyser le texte au clavier (Ratures, Fact-check & Notes IA)">
                <button
                  className={`btn-icon ${isAnalyzingText ? 'analyzing-active' : ''}`}
                  onClick={onAnalyzeText}
                  disabled={isAnalyzingText}
                  aria-label="Analyser le texte par IA"
                >
                  <IconSparkles size={16} strokeWidth={2} />
                </button>
              </Tooltip>
            )}
            <div className="editor-toolbar-divider" />
          </>
        )}

        <Tooltip content="Annuler la dernière action" shortcut="⌘Z">
          <button
            className="btn-icon"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Annuler"
          >
            <IconUndo size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip content="Rétablir l'action annulée" shortcut="⌘⇧Z">
          <button
            className="btn-icon"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Rétablir"
          >
            <IconRedo size={16} strokeWidth={2} />
          </button>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        <Tooltip content="Exporter en Markdown (.md)">
          <button className="btn-icon" onClick={onExport} aria-label="Exporter en Markdown">
            <IconDownload size={16} strokeWidth={2} />
          </button>
        </Tooltip>

        <Tooltip content="Exporter en PDF Éditorial (Couverture & Mise en page)">
          <button
            className="btn-icon pdf-export-btn"
            onClick={onExportPdf || onExport}
            aria-label="Exporter en PDF éditorial"
          >
            <IconBook size={16} strokeWidth={2} />
          </button>
        </Tooltip>

        {onToggleSpeech && (
          <Tooltip
            content={
              isSpeechPlaying
                ? isSpeechPaused
                  ? 'Reprendre la lecture audio'
                  : 'Mettre en pause la lecture'
                : 'Écouter le chapitre (Lecture audio)'
            }
          >
            <button
              className={`btn-icon ${isSpeechPlaying ? 'active' : ''}`}
              onClick={onToggleSpeech}
              aria-label="Lecture audio"
            >
              {isSpeechPlaying ? (
                isSpeechPaused ? (
                  <IconPlay size={15} strokeWidth={2} />
                ) : (
                  <IconPause size={15} strokeWidth={2} />
                )
              ) : (
                <IconVolume size={16} strokeWidth={2} />
              )}
            </button>
          </Tooltip>
        )}
        {isSpeechPlaying && onStopSpeech && (
          <Tooltip content="Arrêter la lecture audio">
            <button className="btn-icon btn-danger-icon" onClick={onStopSpeech} aria-label="Arrêter la lecture">
              <IconStop size={15} strokeWidth={2} />
            </button>
          </Tooltip>
        )}

        <Tooltip content={isFocusMode ? 'Quitter le mode concentration' : 'Mode concentration (sans distraction)'}>
          <button
            className={`btn-icon ${isFocusMode ? 'active' : ''}`}
            onClick={onToggleFocus}
            aria-label="Mode concentration"
          >
            <IconTarget size={16} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {/* Right: Panels + Stats */}
      <div className="editor-toolbar-right">
        {/* Save indicator */}
        <span className="editor-save-indicator">
          {isDirty ? (
            <span className="save-status-dirty">Enregistrement…</span>
          ) : lastSaved ? (
            <span className="save-status-saved">
              <IconCheck size={12} strokeWidth={2.5} />
              <span>{formatSaveTime(lastSaved)}</span>
            </span>
          ) : null}
        </span>

        {/* Word count */}
        <Tooltip content={`Total manuscrit : ${totalWordCount.toLocaleString('fr-FR')} mots`}>
          <span className="editor-word-count">
            {wordCount.toLocaleString('fr-FR')} mots
          </span>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        {/* Review toggle */}
        <Tooltip content={isReviewOpen ? 'Fermer les révisions IA' : 'Révisions & Ratures Gemini'}>
          <button
            className={`btn-icon ${isReviewOpen ? 'active' : ''}`}
            onClick={onToggleReview}
            aria-label="Révisions IA"
          >
            <IconScissors size={15} strokeWidth={2} />
            {pendingReviewCount > 0 && <span className="toolbar-badge">{pendingReviewCount}</span>}
          </button>
        </Tooltip>

        {/* Notes toggle */}
        <Tooltip content={isNotesOpen ? 'Fermer les notes' : 'Notes & Annotations'}>
          <button
            className={`btn-icon ${isNotesOpen ? 'active' : ''}`}
            onClick={onToggleNotes}
            aria-label="Notes du chapitre"
          >
            <IconPaperclip size={15} strokeWidth={2} />
            {noteCount > 0 && <span className="toolbar-badge">{noteCount}</span>}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
