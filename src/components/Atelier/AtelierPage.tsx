/**
 * AtelierPage — Main writing studio page (REFONTE)
 *
 * Layout: Sidebar (chapters + record) | Editor | Review/Notes panels (drawer right)
 *
 * All state managed by useManuscript hook.
 * Dictation & Manual Keyboard Text analysis powered by Gemini AI.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useManuscript } from '@/hooks/useManuscript';
import { useDictation } from '@/hooks/useDictation';
import { useSpeech } from '@/hooks/useSpeech';
import type { TextBlock, PendingReview } from '@/types/editor';
import { ExportWizard } from '@/features/export/components/ExportWizard';
import { analyzeWrittenText } from '@/services/ai/transcription';
import { useAuth } from '@/components/Auth/AuthProvider';
import ChapterList from './ChapterList';
import Editor from './Editor';
import EditorToolbar from './EditorToolbar';
import ReviewPanel from './ReviewPanel';
import NotesPanel from './NotesPanel';
import RecordButton from './RecordButton';

export default function AtelierPage() {
  const { manuscript: activeManuscript } = useAuth();
  const manuscript = useManuscript();
  const { state: ms, activeChapter, dispatch, wordCount, totalWordCount, pendingReviewCount } = manuscript;

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

  // Analyze text typed directly via keyboard
  const handleAnalyzeWrittenText = useCallback(async () => {
    const chapterContent = activeChapter?.blocks.map((b) => b.content).join('\n\n') || '';
    if (!chapterContent.trim()) {
      alert('Veuillez d\'abord rédiger du texte dans ce chapitre avant de lancer l\'analyse IA.');
      return;
    }

    setIsAnalyzingText(true);
    try {
      const res = await analyzeWrittenText(chapterContent, { currentChapter: ms.activeChapterIndex });
      
      const reviews: PendingReview[] = [];

      if (res.ratures && res.ratures.length > 0) {
        res.ratures.forEach((r: any) => {
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
            explanation: c.status === 'confirmed' ? 'Vérifié ✓' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
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
            content: `💡 Idée : ${content}`,
          });
        });
        setIsNotesOpen(true);
      }
    } catch (err: any) {
      alert(`Erreur d'analyse IA : ${err?.message || err}`);
    } finally {
      setIsAnalyzingText(false);
    }
  }, [activeChapter, ms.activeChapterIndex, dispatch]);

  // When dictation completes, insert results into the manuscript
  useEffect(() => {
    if (ds.phase !== 'complete' || !ds.result) return;

    // Insert dictated text blocks
    if (ds.result.jetBrut && ds.result.jetBrut.length > 0) {
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
    }

    // Add ratures + corrections as pending reviews
    const reviews: PendingReview[] = [];

    if (ds.result.ratures && ds.result.ratures.length > 0) {
      ds.result.ratures.forEach((r: any) => {
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

    if (ds.corrections && ds.corrections.length > 0) {
      ds.corrections.forEach((c) => {
        reviews.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'correction',
          original: c.text,
          suggestion: c.suggestion || '',
          source: c.source,
          explanation: c.status === 'confirmed' ? 'Vérifié ✓' : c.status === 'caution' ? 'À vérifier' : 'Erreur détectée',
          status: 'pending',
        });
      });
    }

    if (reviews.length > 0) {
      dispatch({ type: 'ADD_REVIEWS', chapterIndex: ms.activeChapterIndex, reviews });
      setIsReviewOpen(true);
    }

    // Add AI-generated notes
    if (ds.result.notes) {
      Object.entries(ds.result.notes).forEach(([, content]) => {
        dispatch({
          type: 'ADD_NOTE',
          chapterIndex: ms.activeChapterIndex,
          content,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds.phase]);

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

      {/* ── Left Sidebar (Chapters + Record) ── */}
      <aside className={`atelier-sidebar ${showMobileSidebar ? 'mobile-visible' : ''}`}>
        <div className="atelier-sidebar-header">
          <h1 className="atelier-logo">
            <span className="atelier-logo-icon">✒️</span>
            <span>L'Atelier</span>
          </h1>
          <button
            className="mobile-sidebar-close"
            onClick={() => setShowMobileSidebar(false)}
          >
            ✕
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
              background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
              fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: 'var(--accent)',
            }}>
              {ds.phase === 'recording' && (
                <>
                  <span style={{ fontWeight: 600 }}>🔴 Enregistrement… {dictation.formatTime(ds.duration)}</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={dictation.pauseRecording} style={{ fontSize: 12, padding: '4px 10px' }}>⏸ Pause</button>
                    <button className="btn btn-primary" onClick={dictation.stopRecording} style={{ fontSize: 12, padding: '4px 12px' }}>⏹ Terminer</button>
                    <button className="btn btn-secondary" onClick={dictation.cancelRecording} style={{ fontSize: 12, padding: '4px 12px', borderColor: '#e53e3e', color: '#e53e3e' }}>❌ Annuler</button>
                  </div>
                </>
              )}
              {ds.phase === 'paused' && (
                <>
                  <span style={{ fontWeight: 600 }}>⏸ En pause ({dictation.formatTime(ds.duration)})</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={dictation.resumeRecording} style={{ fontSize: 12, padding: '4px 10px' }}>▶️ Reprendre</button>
                    <button className="btn btn-primary" onClick={dictation.stopRecording} style={{ fontSize: 12, padding: '4px 12px' }}>⏹ Terminer</button>
                    <button className="btn btn-secondary" onClick={dictation.cancelRecording} style={{ fontSize: 12, padding: '4px 12px', borderColor: '#e53e3e', color: '#e53e3e' }}>❌ Annuler</button>
                  </div>
                </>
              )}
              {ds.phase === 'processing' && (
                <>
                  <span style={{ fontWeight: 600 }}>⚙️ Gemini analyse la dictée…</span>
                  <button className="btn btn-secondary" onClick={dictation.cancelRecording} style={{ fontSize: 12, padding: '4px 12px', marginLeft: 'auto', borderColor: '#e53e3e', color: '#e53e3e' }}>❌ Annuler</button>
                </>
              )}
              {ds.phase === 'error' && <span style={{ fontWeight: 600, color: '#c0392b' }}>❌ {ds.error}</span>}
            </div>
          )}

          {/* Search bar */}
          {showSearch && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
              background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <input
                type="text"
                placeholder="Rechercher dans le manuscrit…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  flex: 1, padding: '4px 8px', border: '1px solid var(--border)',
                  borderRadius: 4, background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 13, outline: 'none',
                }}
              />
              <button
                className="btn btn-ghost"
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                style={{ fontSize: 12, padding: '2px 8px' }}
              >
                ✕
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
