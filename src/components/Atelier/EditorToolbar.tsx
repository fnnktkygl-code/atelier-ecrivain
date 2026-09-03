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
 * - Indicateur de statut de sauvegarde en temps réel (Local + Cloud Firestore)
 * - Compteur de mots et badges de révisions / notes
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Tooltip from '@/components/Shared/Tooltip';
import type { SaveStatus } from '@/types/editor';
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
  IconMoreVertical,
  IconCheck,
  IconCloudCheck,
  IconCloudUpload,
  IconCloudOff,
  IconAlertCircle,
} from '@/components/Shared/Icons';

interface EditorToolbarProps {
  chapterTitle: string;
  wordCount: number;
  totalWordCount: number;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  lastSaved: number | null;
  lastCloudSync?: number | null;
  saveStatus?: SaveStatus;
  isCloudConnected?: boolean;
  onForceSave?: () => void;
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
  lastCloudSync = null,
  saveStatus = 'saved',
  isCloudConnected = false,
  onForceSave,
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ⌘S / Ctrl+S → Force cloud save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onForceSave?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onForceSave]);

  const formatSaveTime = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const isRecording = dictationPhase === 'recording' || dictationPhase === 'processing';

  const renderSaveIndicator = () => {
    if (isDirty || saveStatus === 'saving') {
      return (
        <Tooltip content="Sauvegarde continue : vos écrits sont enregistrés en direct.">
          <span className="save-status-indicator saving">
            <span className="save-pulse-dot" />
            <span>Sauvegarde…</span>
          </span>
        </Tooltip>
      );
    }

    if (saveStatus === 'syncing') {
      return (
        <Tooltip content="Synchronisation de votre manuscrit avec le cloud Firestore…">
          <span className="save-status-indicator syncing">
            <IconCloudUpload size={13} strokeWidth={2} />
            <span>Sync…</span>
          </span>
        </Tooltip>
      );
    }

    if (saveStatus === 'synced' && isCloudConnected) {
      const timeStr = formatSaveTime(lastCloudSync || lastSaved);
      return (
        <Tooltip content={`Synchronisé avec le cloud (${timeStr}). Cliquez pour forcer la synchronisation.`}>
          <span
            className="save-status-indicator synced clickable-save-pill"
            onClick={onForceSave}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <IconCloudCheck size={13} strokeWidth={2} />
            <span>Enregistré ({timeStr})</span>
          </span>
        </Tooltip>
      );
    }

    if (saveStatus === 'offline') {
      return (
        <Tooltip content="Mode hors-ligne : Sauvegardé en local. La synchronisation reprendra dès reconnexion.">
          <span className="save-status-indicator offline">
            <IconCloudOff size={13} strokeWidth={2} />
            <span>Hors-ligne ({formatSaveTime(lastSaved)})</span>
          </span>
        </Tooltip>
      );
    }

    if (lastSaved) {
      const timeStr = formatSaveTime(lastSaved);
      return (
        <Tooltip content={`Enregistré localement sur votre navigateur (${timeStr}). Cliquez pour synchroniser.`}>
          <span
            className="save-status-indicator synced clickable-save-pill"
            onClick={onForceSave}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <IconCloudCheck size={13} strokeWidth={2} />
            <span>Enregistré ({timeStr})</span>
          </span>
        </Tooltip>
      );
    }

    return null;
  };

  return (
    <div className="editor-toolbar">
      {/* ── Îlot 1 : Identité & Sauvegarde ── */}
      <div className="editor-toolbar-left">
        {onToggleSidebar && (
          <button
            className="editor-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title="Afficher les chapitres"
            aria-label="Afficher la liste des chapitres"
          >
            <IconFolder size={15} strokeWidth={2} />
            <span className="toggle-btn-label">Chapitres</span>
          </button>
        )}
        <span className="editor-toolbar-title">{chapterTitle}</span>
        <span className="editor-save-indicator">{renderSaveIndicator()}</span>
        {onForceSave && (
          <Tooltip content="Sauvegarder manuellement vers le cloud" shortcut="⌘S">
            <button
              className="btn-icon btn-force-save"
              onClick={onForceSave}
              aria-label="Sauvegarder maintenant"
            >
              <IconCloudUpload size={15} strokeWidth={2} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* ── Îlot 2 : Création & Polissage IA ── */}
      <div className="editor-toolbar-center">
        {onStartDictation && (
          <Tooltip content="Démarrer la dictée vocale" shortcut="⌘D">
            <button
              className={`btn-icon ${isRecording ? 'recording-active' : ''}`}
              onClick={onStartDictation}
              disabled={dictationPhase !== 'idle' && dictationPhase !== 'complete' && dictationPhase !== 'error'}
              aria-label="Démarrer la dictée vocale"
            >
              <IconMic size={16} strokeWidth={2} />
            </button>
          </Tooltip>
        )}

        {onAnalyzeText && (
          <Tooltip content={`Analyser tout le chapitre (${wordCount} mots) — Ratures & Style`}>
            <button
              className={`btn-icon ${isAnalyzingText ? 'analyzing-active' : ''}`}
              onClick={onAnalyzeText}
              disabled={isAnalyzingText}
              aria-label="Analyser tout le chapitre par IA"
            >
              <IconSparkles size={15} strokeWidth={2} />
            </button>
          </Tooltip>
        )}

        <div className="editor-toolbar-divider" />

        <Tooltip content="Annuler" shortcut="⌘Z">
          <button className="btn-icon" onClick={onUndo} disabled={!canUndo} aria-label="Annuler">
            <IconUndo size={15} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip content="Rétablir" shortcut="⌘⇧Z">
          <button className="btn-icon" onClick={onRedo} disabled={!canRedo} aria-label="Rétablir">
            <IconRedo size={15} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {/* ── Îlot 3 : Tiroirs d'Atelier & Statistiques ── */}
      <div className="editor-toolbar-right">
        <Tooltip content={`Total manuscrit : ${totalWordCount.toLocaleString('fr-FR')} mots`}>
          <span className="editor-word-count">
            {wordCount.toLocaleString('fr-FR')} mots
          </span>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        {/* Review drawer toggle */}
        <Tooltip content={isReviewOpen ? 'Fermer les révisions' : 'Ratures & Polissage (max 15)'}>
          <button
            className={`btn-icon ${isReviewOpen ? 'active' : ''}`}
            onClick={onToggleReview}
            aria-label="Ratures & Révisions"
          >
            <IconScissors size={15} strokeWidth={2} />
            {pendingReviewCount > 0 && <span className="toolbar-badge">{pendingReviewCount}</span>}
          </button>
        </Tooltip>

        {/* Notes drawer toggle */}
        <Tooltip content={isNotesOpen ? 'Fermer les notes' : 'Notes & Pense-bête'}>
          <button
            className={`btn-icon ${isNotesOpen ? 'active' : ''}`}
            onClick={onToggleNotes}
            aria-label="Notes du chapitre"
          >
            <IconPaperclip size={15} strokeWidth={2} />
            {noteCount > 0 && <span className="toolbar-badge">{noteCount}</span>}
          </button>
        </Tooltip>

        <div className="editor-toolbar-divider" />

        {/* ── Îlot 4 : Menu Plus « ... » (Exports, TTS, Mode Zen) ── */}
        <div className="toolbar-more-menu-container" ref={moreMenuRef} style={{ position: 'relative' }}>
          <button
            className={`btn-icon ${showMoreMenu ? 'active' : ''}`}
            onClick={() => setShowMoreMenu((prev) => !prev)}
            title="Options & Exports"
            aria-label="Options et exports"
          >
            <IconMoreVertical size={16} strokeWidth={2} />
          </button>

          {showMoreMenu && (
            <div className="toolbar-dropdown-menu">
              <button
                className="dropdown-menu-item"
                onClick={() => {
                  onExportPdf ? onExportPdf() : onExport();
                  setShowMoreMenu(false);
                }}
              >
                <IconBook size={14} />
                <span>Studio PDF Éditorial & Couverture</span>
              </button>

              <button
                className="dropdown-menu-item"
                onClick={() => {
                  onExport();
                  setShowMoreMenu(false);
                }}
              >
                <IconDownload size={14} />
                <span>Exporter en Markdown (.md)</span>
              </button>

              {onToggleSpeech && (
                <button
                  className="dropdown-menu-item"
                  onClick={() => {
                    onToggleSpeech();
                    setShowMoreMenu(false);
                  }}
                >
                  <IconVolume size={14} />
                  <span>{isSpeechPlaying ? (isSpeechPaused ? 'Reprendre la lecture TTS' : 'Pause lecture TTS') : 'Écouter le chapitre (TTS)'}</span>
                </button>
              )}

              <button
                className={`dropdown-menu-item ${isFocusMode ? 'active' : ''}`}
                onClick={() => {
                  onToggleFocus();
                  setShowMoreMenu(false);
                }}
              >
                <IconTarget size={14} />
                <span>{isFocusMode ? 'Quitter le Mode Zen' : 'Activer le Mode Zen'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
