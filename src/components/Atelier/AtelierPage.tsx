/**
 * AtelierPage — Studio d'écriture principal (Japandi Minimaliste)
 *
 * Agencement : Barre latérale (chapitres + enregistreur) | Éditeur | Tiroir droit (Révisions / Notes)
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useManuscript } from '@/hooks/useManuscript';
import { useDictation } from '@/hooks/useDictation';
import { useSpeech } from '@/hooks/useSpeech';
import type { TextBlock, PendingReview } from '@/types/editor';
import { ExportWizard } from '@/features/export/components/ExportWizard';
import { analyzeWrittenText, analyzeBlockText, analyzeSelectionText } from '@/services/ai/transcription';
import { useAuth } from '@/components/Auth/AuthProvider';
import ChapterList from './ChapterList';
import Editor from './Editor';
import EditorToolbar from './EditorToolbar';
import ReviewPanel from './ReviewPanel';
import NotesPanel from './NotesPanel';
import RecordButton from './RecordButton';
import {
  IconFeather,
  IconClose,
  IconSearch,
  IconPause,
  IconPlay,
  IconStop,
  IconSparkles,
  IconAlertCircle,
} from '@/components/Shared/Icons';

export default function AtelierPage() {
  const { user, manuscript: activeManuscript } = useAuth();
  const manuscript = useManuscript();
  const { state: ms, activeChapter, dispatch, wordCount, totalWordCount, pendingReviewCount, saveStatus, forceSave } = manuscript;

  const dictation = useDictation(ms.activeChapterIndex);
  const { state: ds } = dictation;
  const speech = useSpeech();

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isPdfWizardOpen, setIsPdfWizardOpen] = useState(false);
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
  const [analyzingBlockId, setAnalyzingBlockId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleToggleSpeech = useCallback(() => {
    if (speech.isPlaying) {
      if (speech.isPaused) {
        speech.resume();
      } else {
        speech.pause();
      }
    } else {
      const textToRead = activeChapter?.blocks.map((b) => b.content).join('\n\n') || '';
      speech.speak(`${activeChapter?.title || ''}.\n\n${textToRead}`);
    }
  }, [speech, activeChapter]);

  // Analyze specific single block
  const handleAnalyzeBlock = useCallback(
    async (blockId: string, content: string) => {
      if (!content.trim()) return;
      setAnalyzingBlockId(blockId);
      showFeedback('Analyse de ce paragraphe en cours (Gemini 3.6 Flash)…');

      try {
        const res = await analyzeBlockText(content, { currentChapter: ms.activeChapterIndex });
        const reviews: PendingReview[] = [];

        if (res.ratures && res.ratures.length > 0) {
          res.ratures.forEach((r) => {
            const origText = typeof r === 'string' ? r : (r.original || r.corrected || '');
            const suggText = typeof r === 'string' ? r : (r.corrected || r.original || '');
            reviews.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'rature',
              original: origText,
              suggestion: suggText,
              explanation: typeof r === 'string' ? undefined : r.explanation,
              status: 'pending',
            });
          });
        }

        if (res.corrections && res.corrections.length > 0) {
          res.corrections.forEach((c) => {
            reviews.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'correction',
              original: c.text,
              suggestion: c.suggestion || '',
              source: c.source,
              explanation: c.status === 'confirmed' ? 'Vérifié' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
              status: 'pending',
            });
          });
        }

        if (reviews.length > 0) {
          dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
          setIsReviewOpen(true);
          showFeedback(`Paragraphe analysé : ${reviews.length} suggestion(s) de rature(s) prête(s).`);
        } else {
          showFeedback('Paragraphe analysé : Le style est fluide, aucune rature nécessaire.');
        }

        if (res.notes) {
          Object.entries(res.notes).forEach(([, noteContent]) => {
            dispatch({
              type: 'ADD_NOTE',
              chapterIndex: ms.activeChapterIndex,
              content: noteContent,
            });
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        showFeedback(`Erreur d'analyse : ${errMsg}`);
      } finally {
        setAnalyzingBlockId(null);
      }
    },
    [ms.activeChapterIndex, dispatch]
  );

  // Analyze highlighted text selection (Notion Style)
  const handleAnalyzeSelection = useCallback(
    async (selectedText: string) => {
      if (!selectedText.trim()) return;
      setAnalyzingBlockId('selection');
      showFeedback('Analyse de la sélection en cours (Gemini 3.6 Flash)…');

      try {
        const res = await analyzeSelectionText(selectedText, { currentChapter: ms.activeChapterIndex });
        const reviews: PendingReview[] = [];

        if (res.ratures && res.ratures.length > 0) {
          res.ratures.forEach((r) => {
            const origText = typeof r === 'string' ? r : (r.original || r.corrected || '');
            const suggText = typeof r === 'string' ? r : (r.corrected || r.original || '');
            reviews.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'rature',
              original: origText,
              suggestion: suggText,
              explanation: typeof r === 'string' ? undefined : r.explanation,
              status: 'pending',
            });
          });
        }

        if (reviews.length > 0) {
          dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
          setIsReviewOpen(true);
          showFeedback(`Sélection analysée : ${reviews.length} suggestion(s) de rature(s).`);
        } else {
          showFeedback('Sélection analysée : Style fluide, aucune rature requise.');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        showFeedback(`Erreur d'analyse : ${errMsg}`);
      } finally {
        setAnalyzingBlockId(null);
      }
    },
    [ms.activeChapterIndex, dispatch]
  );

  const handleFactCheckSelection = useCallback(
    async (selectedText: string) => {
      if (!selectedText.trim()) return;
      setAnalyzingBlockId('selection');
      showFeedback('Vérification factuelle de la sélection…');
      try {
        const res = await analyzeSelectionText(selectedText, { currentChapter: ms.activeChapterIndex });
        if (res.corrections && res.corrections.length > 0) {
          const reviews: PendingReview[] = res.corrections.map((c) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'correction',
            original: c.text,
            suggestion: c.suggestion || '',
            source: c.source,
            explanation: c.status === 'confirmed' ? 'Vérifié' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
            status: 'pending',
          }));
          dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
          setIsReviewOpen(true);
          showFeedback(`Vérification : ${reviews.length} élément(s) vérifié(s).`);
        } else {
          showFeedback('Vérification : Aucune anomalie factuelle détectée.');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        showFeedback(`Erreur : ${errMsg}`);
      } finally {
        setAnalyzingBlockId(null);
      }
    },
    [ms.activeChapterIndex, dispatch]
  );

  const handleCreateNoteFromSelection = useCallback(
    (selectedText: string) => {
      if (!selectedText.trim()) return;
      dispatch({
        type: 'ADD_NOTE',
        chapterIndex: ms.activeChapterIndex,
        content: `Note sur : « ${selectedText.slice(0, 100)}${selectedText.length > 100 ? '…' : ''} »`,
      });
      setIsNotesOpen(true);
      showFeedback('Note créée à partir de la sélection.');
    },
    [ms.activeChapterIndex, dispatch]
  );

  // Analyze entire chapter
  const handleAnalyzeWrittenText = useCallback(async () => {
    const chapterContent = activeChapter?.blocks.map((b) => b.content).join('\n\n') || '';
    if (!chapterContent.trim()) {
      showFeedback('Veuillez d’abord rédiger du texte dans ce chapitre avant de lancer l’analyse.');
      return;
    }

    setIsAnalyzingText(true);
    showFeedback('Analyse globale du chapitre en cours (Gemini 3.6 Flash)…');

    try {
      const res = await analyzeWrittenText(chapterContent, { currentChapter: ms.activeChapterIndex });
      const reviews: PendingReview[] = [];

      if (res.ratures && res.ratures.length > 0) {
        res.ratures.forEach((r) => {
          const origText = typeof r === 'string' ? r : (r.original || r.corrected || '');
          const suggText = typeof r === 'string' ? r : (r.corrected || r.original || '');
          reviews.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'rature',
            original: origText,
            suggestion: suggText,
            explanation: typeof r === 'string' ? undefined : r.explanation,
            status: 'pending',
          });
        });
      }

      if (res.corrections && res.corrections.length > 0) {
        res.corrections.forEach((c) => {
          reviews.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'correction',
            original: c.text,
            suggestion: c.suggestion || '',
            source: c.source,
            explanation: c.status === 'confirmed' ? 'Vérifié' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
            status: 'pending',
          });
        });
      }

      if (reviews.length > 0) {
        dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
        setIsReviewOpen(true);
      }

      if (res.notes) {
        Object.entries(res.notes).forEach(([, content]) => {
          dispatch({
            type: 'ADD_NOTE',
            chapterIndex: ms.activeChapterIndex,
            content,
          });
        });
        setIsNotesOpen(true);
      }

      if (res.floatingNotes && res.floatingNotes.length > 0) {
        res.floatingNotes.forEach((content) => {
          dispatch({
            type: 'ADD_NOTE',
            chapterIndex: ms.activeChapterIndex,
            content: `Idée : ${content}`,
          });
        });
        setIsNotesOpen(true);
      }

      if (reviews.length > 0) {
        showFeedback(`Analyse terminée : ${reviews.length} suggestion(s) de rature(s) prête(s).`);
      } else {
        showFeedback('Analyse terminée : Style fluide, aucune rature requise.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showFeedback(`Erreur d'analyse : ${errMsg}`);
    } finally {
      setIsAnalyzingText(false);
    }
  }, [activeChapter, ms.activeChapterIndex, dispatch]);

  // Deep-link support: Auto-arm dictation if requested via ?action=dictate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'dictate') {
        window.history.replaceState({}, '', window.location.pathname);
        if (ds.phase === 'idle') {
          dictation.startRecording();
          setTimeout(() => {
            showFeedback('Microphone activé — Vous pouvez dicter librement.');
          }, 100);
        }
      }
    }
  }, [ds.phase, dictation]);

  const insertedJetBrutKeyRef = useRef<string | null>(null);
  const insertedReviewsKeyRef = useRef<string | null>(null);

  // Reset tracking when starting a new recording or returning to idle
  useEffect(() => {
    if (ds.phase === 'idle' || ds.phase === 'recording') {
      insertedJetBrutKeyRef.current = null;
      insertedReviewsKeyRef.current = null;
    }
  }, [ds.phase]);

  // When dictation completes or receives results, insert into the manuscript
  useEffect(() => {
    if (ds.phase !== 'complete' || !ds.result) return;

    // 1. Insert dictated text blocks immediately (only once per dictation session)
    if (ds.result.jetBrut && ds.result.jetBrut.length > 0) {
      const jetBrutKey = ds.result.jetBrut.join(':::');
      if (insertedJetBrutKeyRef.current !== jetBrutKey) {
        insertedJetBrutKeyRef.current = jetBrutKey;
        const newBlocks: TextBlock[] = ds.result.jetBrut.map((text) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          content: text,
          type: 'paragraph' as const,
          source: 'dictation' as const,
          createdAt: Date.now(),
        }));

        dispatch({
          type: 'INSERT_DICTATION',
          chapterIndex: ms.activeChapterIndex,
          afterBlockIndex: ms.insertionPoint,
          blocks: newBlocks,
        });
        showFeedback('Texte dicté intégré immédiatement dans le manuscrit.');
      }
    }

    // 2. Add ratures + corrections as pending reviews (when available from background analysis)
    const reviews: PendingReview[] = [];

    if (ds.result.ratures && ds.result.ratures.length > 0) {
      ds.result.ratures.forEach((r) => {
        const text = typeof r === 'string' ? r : String(r);
        reviews.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'rature',
          original: text,
          suggestion: text,
          explanation: undefined,
          status: 'pending',
        });
      });
    }

    if (ds.corrections && ds.corrections.length > 0) {
      ds.corrections.forEach((c) => {
        reviews.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'correction',
          original: c.text,
          suggestion: c.suggestion || '',
          source: c.source,
          explanation: c.status === 'confirmed' ? 'Vérifié' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
          status: 'pending',
        });
      });
    }

    if (reviews.length > 0) {
      const reviewsKey = reviews.map((r) => r.original + (r.suggestion || '')).join(':::');
      if (insertedReviewsKeyRef.current !== reviewsKey) {
        insertedReviewsKeyRef.current = reviewsKey;
        dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
        setTimeout(() => setIsReviewOpen(true), 0);
      }
    }

    // 3. Add AI-generated notes
    if (ds.result.notes) {
      Object.entries(ds.result.notes).forEach(([, content]) => {
        dispatch({
          type: 'ADD_NOTE',
          chapterIndex: ms.activeChapterIndex,
          content,
        });
      });
    }
  }, [ds.phase, ds.result, ds.corrections, dispatch, ms.activeChapterIndex, ms.insertionPoint, showFeedback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        manuscript.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        manuscript.redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manuscript]);

  const handleToggleReview = useCallback(() => {
    setIsReviewOpen((prev) => !prev);
    if (isNotesOpen) setIsNotesOpen(false);
  }, [isNotesOpen]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesOpen((prev) => !prev);
    if (isReviewOpen) setIsReviewOpen(false);
  }, [isReviewOpen]);

  const rightPanelOpen = isReviewOpen || isNotesOpen;

  return (
    <div className={`atelier-layout ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* ── Overlay mobile sidebar ── */}
      {showMobileSidebar && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* ── Feedback Notification Toast ── */}
      {feedbackMessage && (
        <div className="atelier-toast-feedback">
          <IconSparkles size={16} strokeWidth={2} />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* ── Left Sidebar (Chapters + Record) ── */}
      <aside className={`atelier-sidebar ${showMobileSidebar ? 'mobile-visible' : ''}`}>
        <div className="atelier-sidebar-header">
          <h1 className="atelier-logo">
            <IconFeather size={20} strokeWidth={2} className="atelier-logo-icon" />
            <span>L&apos;Atelier</span>
          </h1>
          <button
            className="mobile-sidebar-close"
            onClick={() => setShowMobileSidebar(false)}
            aria-label="Fermer le menu"
          >
            <IconClose size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="atelier-sidebar-content">
          <ChapterList
            chapters={ms.chapters}
            activeIndex={ms.activeChapterIndex}
            dispatch={dispatch}
            onCloseSidebar={() => setShowMobileSidebar(false)}
            onOpenPdfExport={() => setIsPdfWizardOpen(true)}
          />
        </div>

        <div className="atelier-sidebar-footer">
          <RecordButton
            phase={ds.phase}
            level={ds.level}
            time={dictation.formatTime(ds.duration)}
            duration={ds.duration}
            maxDuration={150}
            statusMessage={ds.statusMessage}
            isAnalyzingInBackground={ds.isAnalyzingInBackground}
            onStart={dictation.startRecording}
            onStop={dictation.stopRecording}
            onPause={dictation.pauseRecording}
            onResume={dictation.resumeRecording}
            onCancel={dictation.cancelRecording}
            onReset={dictation.reset}
            error={ds.error}
          />
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="atelier-content">
        {/* ── Main editor area ── */}
        <div className={`atelier-main ${rightPanelOpen ? 'with-panel' : ''}`}>
          <EditorToolbar
            chapterTitle={activeChapter?.title || 'Sans titre'}
            wordCount={wordCount}
            totalWordCount={totalWordCount}
            canUndo={manuscript.canUndo}
            canRedo={manuscript.canRedo}
            isDirty={ms.isDirty}
            lastSaved={ms.lastSaved}
            lastCloudSync={ms.lastCloudSync}
            saveStatus={saveStatus}
            isCloudConnected={!!user}
            onForceSave={forceSave}
            pendingReviewCount={pendingReviewCount}
            noteCount={activeChapter?.notes.length || 0}
            isReviewOpen={isReviewOpen}
            isNotesOpen={isNotesOpen}
            isFocusMode={isFocusMode}
            onUndo={manuscript.undo}
            onRedo={manuscript.redo}
            onExport={manuscript.exportMarkdown}
            onToggleReview={handleToggleReview}
            onToggleNotes={handleToggleNotes}
            onToggleFocus={() => setIsFocusMode(!isFocusMode)}
            onStartDictation={dictation.startRecording}
            onAnalyzeText={handleAnalyzeWrittenText}
            isAnalyzingText={isAnalyzingText}
            dictationPhase={ds.phase}
            onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
            isSpeechPlaying={speech.isPlaying}
            isSpeechPaused={speech.isPaused}
            onToggleSpeech={handleToggleSpeech}
            onStopSpeech={speech.stop}
            onExportPdf={() => setIsPdfWizardOpen(true)}
          />

          {/* Dictation Status Bar (Always visible during recording/processing) */}
          {ds.phase !== 'idle' && (
            <div className="dictation-status-bar">
              {ds.phase === 'recording' && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div className="dictation-status-indicator recording">
                      <span className="recording-pulse-dot" />
                      <span>Enregistrement en cours… {dictation.formatTime(ds.duration)} / 02:30</span>
                    </div>
                    <div className="dictation-status-actions">
                      <button className="btn-dictation-control" onClick={dictation.pauseRecording}>
                        <IconPause size={14} />
                        <span>Pause</span>
                      </button>
                      <button className="btn-dictation-control primary" onClick={dictation.stopRecording}>
                        <IconStop size={14} />
                        <span>Terminer</span>
                      </button>
                      <button className="btn-dictation-control danger" onClick={dictation.cancelRecording}>
                        <IconClose size={14} />
                        <span>Annuler</span>
                      </button>
                    </div>
                  </div>
                  {ds.interimText && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--surface-2)',
                        borderLeft: '3px solid var(--accent)',
                        borderRadius: 4,
                        fontSize: 13,
                        fontStyle: 'italic',
                        color: 'var(--text-soft)',
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--accent)', marginRight: 6 }}>En direct :</span>
                      « {ds.interimText} »
                    </div>
                  )}
                </div>
              )}
              {ds.phase === 'paused' && (
                <>
                  <div className="dictation-status-indicator paused">
                    <IconPause size={15} />
                    <span>En pause ({dictation.formatTime(ds.duration)})</span>
                  </div>
                  <div className="dictation-status-actions">
                    <button className="btn-dictation-control" onClick={dictation.resumeRecording}>
                      <IconPlay size={14} />
                      <span>Reprendre</span>
                    </button>
                    <button className="btn-dictation-control primary" onClick={dictation.stopRecording}>
                      <IconStop size={14} />
                      <span>Terminer</span>
                    </button>
                    <button className="btn-dictation-control danger" onClick={dictation.cancelRecording}>
                      <IconClose size={14} />
                      <span>Annuler</span>
                    </button>
                  </div>
                </>
              )}
              {ds.phase === 'processing' && (
                <>
                  <div className="dictation-status-indicator processing">
                    <span className="processing-spinner" />
                    <span>{ds.statusMessage || 'Transcription instantanée…'}</span>
                  </div>
                  <button className="btn-dictation-control danger" onClick={dictation.cancelRecording}>
                    <IconClose size={14} />
                    <span>Annuler</span>
                  </button>
                </>
              )}
              {ds.phase === 'error' && (
                <div className="dictation-status-indicator error">
                  <IconAlertCircle size={15} />
                  <span>{ds.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Search bar */}
          {showSearch && (
            <div className="atelier-search-bar">
              <IconSearch size={15} strokeWidth={2} />
              <input
                type="text"
                placeholder="Rechercher dans le manuscrit…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="atelier-search-input"
              />
              <button
                className="btn-close-search"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                aria-label="Fermer la recherche"
              >
                <IconClose size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          <div className="atelier-editor-container">
            {activeChapter ? (
              <Editor
                chapter={activeChapter}
                chapterIndex={ms.activeChapterIndex}
                insertionPoint={ms.insertionPoint}
                dispatch={dispatch}
                searchQuery={searchQuery}
                focusMode={isFocusMode}
                onStartDictation={dictation.startRecording}
                dictationPhase={ds.phase}
                onAnalyzeBlock={handleAnalyzeBlock}
                analyzingBlockId={analyzingBlockId}
                onAnalyzeSelection={handleAnalyzeSelection}
                onFactCheckSelection={handleFactCheckSelection}
                onCreateNoteFromSelection={handleCreateNoteFromSelection}
              />
            ) : (
              <div className="atelier-empty-state">
                <p>Aucun chapitre sélectionné.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Review / Corrections ── */}
        <ReviewPanel
          reviews={activeChapter?.pendingReviews || []}
          chapterIndex={ms.activeChapterIndex}
          dispatch={dispatch}
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
        />

        {/* ── Right Panel: Notes ── */}
        <NotesPanel
          notes={activeChapter?.notes || []}
          chapterIndex={ms.activeChapterIndex}
          chapterTitle={activeChapter?.title}
          manuscriptContext={activeChapter?.blocks.map((b) => b.content).join('\n\n')}
          dispatch={dispatch}
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
        />
      </div>

      {/* ── PDF Export Wizard Modal ── */}
      <ExportWizard
        manuscriptId={activeManuscript?.id || 'default-manuscript'}
        manuscriptTitle={activeManuscript?.title || 'Mon Livre'}
        chapters={ms.chapters}
        isOpen={isPdfWizardOpen}
        onClose={() => setIsPdfWizardOpen(false)}
      />
    </div>
  );
}
