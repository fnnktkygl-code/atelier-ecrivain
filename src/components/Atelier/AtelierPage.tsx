/**
 * AtelierPage — Main writing studio page (REFONTE)
 *
 * Layout: Sidebar (chapters + record) | Editor | Review/Notes panels (drawer right)
 *
 * All state managed by useManuscript hook.
 * Dictation results insert at cursor position.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useManuscript } from '@/hooks/useManuscript';
import { useDictation } from '@/hooks/useDictation';
import type { TextBlock, PendingReview } from '@/types/editor';
import ChapterList from './ChapterList';
import Editor from './Editor';
import EditorToolbar from './EditorToolbar';
import ReviewPanel from './ReviewPanel';
import NotesPanel from './NotesPanel';
import RecordButton from './RecordButton';

export default function AtelierPage() {
  const manuscript = useManuscript();
  const { state: ms, activeChapter, dispatch, wordCount, totalWordCount, pendingReviewCount } = manuscript;

  const dictation = useDictation(ms.activeChapterIndex);
  const { state: ds } = dictation;

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

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
      ds.result.ratures.forEach((r) => {
        reviews.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'rature',
          original: typeof r === 'string' ? '' : r,
          suggestion: typeof r === 'string' ? r : '',
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
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manuscript]);

  const handleToggleReview = useCallback(() => {
    setIsReviewOpen((v) => !v);
    if (!isReviewOpen) setIsNotesOpen(false);
  }, [isReviewOpen]);

  const handleToggleNotes = useCallback(() => {
    setIsNotesOpen((v) => !v);
    if (!isNotesOpen) setIsReviewOpen(false);
  }, [isNotesOpen]);

  const rightPanelOpen = isReviewOpen || isNotesOpen;

  return (
    <div className={`atelier ${isFocusMode ? 'focus-mode' : ''}`}>
      <div className="atelier-content">
        {/* ── Sidebar ── */}
        {!isFocusMode && (
          <>
            {showMobileSidebar && (
              <div 
                onClick={() => setShowMobileSidebar(false)}
                style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  zIndex: 40
                }}
              />
            )}
            <div
              className={`atelier-sidebar ${showMobileSidebar ? 'mobile-open' : ''}`}
            >
            <ChapterList
              chapters={ms.chapters}
              activeIndex={ms.activeChapterIndex}
              dispatch={dispatch}
              onCloseSidebar={() => setShowMobileSidebar(false)}
            />

            {/* Record area at bottom */}
            <div className="sidebar-record-area">
              {/* Insertion point indicator */}
              {ms.insertionPoint !== null && (
                <div className="insertion-indicator">
                  🎙️ La dictée s&apos;insérera après le bloc {ms.insertionPoint + 1}
                </div>
              )}

              {!ds.firebaseConfigured && ds.phase === 'idle' && (
                <div className="sidebar-firebase-warning">
                  ⚠️ Mode démo — configurez Firebase dans <code>.env.local</code>
                </div>
              )}

              <RecordButton
                phase={ds.phase}
                level={ds.level}
                time={dictation.formatTime(ds.duration)}
                onStart={dictation.startRecording}
                onPause={dictation.pauseRecording}
                onResume={dictation.resumeRecording}
                onStop={dictation.stopRecording}
                onReset={dictation.reset}
                error={ds.error}
              />

              {/* Processing indicator */}
              {ds.phase === 'processing' && (
                <div className="processing-indicator">
                  <span className="processing-spinner" />
                  Analyse par Gemini en cours...
                </div>
              )}

              {/* Summary after dictation */}
              {ds.summary && ds.phase === 'complete' && (
                <div className="dictation-summary">
                  ✨ {ds.summary}
                </div>
              )}
            </div>
          </div>
          </>
        )}

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
            dictationPhase={ds.phase}
            onToggleSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
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
                  <button className="btn btn-primary" onClick={dictation.stopRecording} style={{ fontSize: 12, padding: '4px 12px', marginLeft: 'auto' }}>
                    ⏹ Terminer
                  </button>
                </>
              )}
              {ds.phase === 'paused' && (
                <>
                  <span style={{ fontWeight: 600 }}>⏸ En pause</span>
                  <button className="btn btn-ghost" onClick={dictation.resumeRecording} style={{ fontSize: 12, padding: '4px 12px', marginLeft: 'auto' }}>▶️ Reprendre</button>
                  <button className="btn btn-primary" onClick={dictation.stopRecording} style={{ fontSize: 12, padding: '4px 12px' }}>⏹ Terminer</button>
                </>
              )}
              {ds.phase === 'processing' && <span style={{ fontWeight: 600 }}>⚙️ Gemini analyse la dictée…</span>}
              {ds.phase === 'error' && <span style={{ fontWeight: 600, color: '#c0392b' }}>❌ {ds.error}</span>}
            </div>
          )}

          {/* Search bar */}
          {showSearch && (
            <div style={{
              padding: '8px 20px', display: 'flex', gap: 8, alignItems: 'center',
              background: 'var(--surface)', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <input
                type="text"
                placeholder="Rechercher dans le manuscrit…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  flex: 1, background: 'var(--hover)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '6px 12px',
                  fontFamily: "'Source Serif 4', serif", fontSize: 14,
                  color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-soft)',
                  cursor: 'pointer', fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="atelier-editor">
            {activeChapter && (
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
            )}
          </div>
        </div>

        {/* ── Right panel (Review or Notes) ── */}
        <ReviewPanel
          reviews={activeChapter?.pendingReviews || []}
          chapterIndex={ms.activeChapterIndex}
          dispatch={dispatch}
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
        />

        <NotesPanel
          notes={activeChapter?.notes || []}
          chapterIndex={ms.activeChapterIndex}
          dispatch={dispatch}
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
        />
      </div>
    </div>
  );
}
