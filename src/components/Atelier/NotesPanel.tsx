/**
 * NotesPanel — Panneau latéral de notes & annotations (Japandi Minimaliste)
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditableNote, ManuscriptAction } from '@/types/editor';
import {
  IconPaperclip,
  IconPlus,
  IconClose,
  IconEdit,
  IconTrash,
  IconCheck,
  IconSparkles,
} from '@/components/Shared/Icons';
import { performDeepResearch, type DeepResearchResult } from '@/services/ai-router/services/deepResearch';

interface NotesPanelProps {
  notes: EditableNote[];
  chapterIndex: number;
  chapterTitle?: string;
  manuscriptContext?: string;
  dispatch: React.Dispatch<ManuscriptAction>;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotesPanel({
  notes,
  chapterIndex,
  chapterTitle,
  manuscriptContext,
  dispatch,
  isOpen,
  onClose,
}: NotesPanelProps) {
  const [activeTab, setActiveTab] = useState<'footnotes' | 'margin'>('footnotes');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'footnote' | 'margin'>('footnote');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Deep Research state
  const [showResearch, setShowResearch] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<DeepResearchResult | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  const footnotes = notes.filter((n) => n.category !== 'margin');
  const marginNotes = notes.filter((n) => n.category === 'margin');
  const displayedNotes = activeTab === 'footnotes' ? footnotes : marginNotes;

  useEffect(() => {
    if (showAddForm && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddForm]);

  const handleAdd = useCallback(() => {
    if (!newNoteContent.trim()) return;
    dispatch({
      type: 'ADD_NOTE',
      chapterIndex,
      content: newNoteContent.trim(),
      category: newNoteCategory,
    });
    setNewNoteContent('');
    setShowAddForm(false);
  }, [chapterIndex, dispatch, newNoteContent, newNoteCategory]);

  const handleRunResearch = async () => {
    const q = researchQuery.trim();
    if (!q || isResearching) return;
    setIsResearching(true);
    setResearchError(null);
    setResearchResult(null);

    try {
      const res = await performDeepResearch(q, {
        currentChapterTitle: chapterTitle,
        manuscriptContext,
      });
      setResearchResult(res);
    } catch (err: unknown) {
      setResearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsResearching(false);
    }
  };

  const handleInsertResearchAsNote = (result: DeepResearchResult) => {
    const sourcesStr = result.sources.length > 0 ? `\n\n📚 Sources : ${result.sources.map((s) => s.title).join(', ')}` : '';
    const noteContent = `🔍 ${result.topic.toUpperCase()}\n${result.summary}\n\n• ${result.keyPoints.join('\n• ')}${sourcesStr}`;
    dispatch({
      type: 'ADD_NOTE',
      chapterIndex,
      content: noteContent,
      category: 'margin',
    });
    setActiveTab('margin');
  };

  const handleUpdate = useCallback(
    (noteId: string, content: string) => {
      dispatch({
        type: 'UPDATE_NOTE',
        chapterIndex,
        noteId,
        content,
      });
      setEditingId(null);
    },
    [chapterIndex, dispatch]
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      dispatch({
        type: 'DELETE_NOTE',
        chapterIndex,
        noteId,
      });
    },
    [chapterIndex, dispatch]
  );

  if (!isOpen) return null;

  return (
    <div className="notes-panel">
      {/* Header */}
      <div className="notes-panel-header">
        <div className="notes-panel-title">
          <IconPaperclip size={17} strokeWidth={2} />
          <h3>Notes du chapitre</h3>
          <span className="count-badge">{notes.length}</span>
        </div>
        <div className="notes-panel-actions">
          <button
            className={`btn-icon ${showResearch ? 'active' : ''}`}
            onClick={() => {
              setShowResearch((prev) => !prev);
              setShowAddForm(false);
            }}
            title="Recherche documentaire approfondie (Deep Research)"
            aria-label="Recherche documentaire"
            style={{ color: showResearch ? 'var(--accent)' : 'inherit' }}
          >
            <IconSparkles size={16} strokeWidth={2} />
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              setNewNoteCategory(activeTab === 'footnotes' ? 'footnote' : 'margin');
              setShowAddForm(true);
              setShowResearch(false);
            }}
            title="Ajouter une note"
            aria-label="Ajouter une note"
          >
            <IconPlus size={16} strokeWidth={2.2} />
          </button>
          <button className="btn-icon" onClick={onClose} title="Fermer" aria-label="Fermer le panneau">
            <IconClose size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="notes-filters" style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
        <button
          className={`pill ${activeTab === 'footnotes' ? 'active' : ''}`}
          onClick={() => setActiveTab('footnotes')}
        >
          Bas de page ({footnotes.length})
        </button>
        <button
          className={`pill ${activeTab === 'margin' ? 'active' : ''}`}
          onClick={() => setActiveTab('margin')}
        >
          Pense-bête ({marginNotes.length})
        </button>
      </div>

      {/* Deep Research Section */}
      {showResearch && (
        <div
          className="deep-research-panel"
          style={{
            padding: '12px 14px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              <IconSparkles size={14} />
              <span>Dossier Deep Research (Google 2026)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="Ex: Évolution du clergé sous la Restauration…"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunResearch()}
              className="note-textarea"
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, height: 32, resize: 'none' }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRunResearch}
              disabled={isResearching || !researchQuery.trim()}
              style={{ fontSize: 11.5 }}
            >
              {isResearching ? 'Recherche…' : 'Lancer'}
            </button>
          </div>

          {researchError && (
            <div style={{ color: 'var(--japandi-terracotta)', fontSize: 11.5 }}>
              {researchError}
            </div>
          )}

          {researchResult && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: 12,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                {researchResult.topic}
              </div>
              <div style={{ color: 'var(--text-soft)', marginBottom: 8 }}>
                {researchResult.summary}
              </div>
              {researchResult.keyPoints.length > 0 && (
                <ul style={{ margin: '0 0 8px 0', paddingLeft: 16, color: 'var(--text)' }}>
                  {researchResult.keyPoints.map((pt, idx) => (
                    <li key={idx} style={{ marginBottom: 3 }}>{pt}</li>
                  ))}
                </ul>
              )}
              {researchResult.sources.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  📚 Sources : {researchResult.sources.map((s, i) => (
                    <span key={i} style={{ marginRight: 6 }}>
                      {s.uri ? (
                        <a href={s.uri} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                          {s.title}
                        </a>
                      ) : s.title}
                      {i < researchResult.sources.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleInsertResearchAsNote(researchResult)}
                  style={{ fontSize: 11.5 }}
                >
                  <IconPlus size={12} />
                  <span>Insérer dans le pense-bête</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add note form */}
      {showAddForm && (
        <div className="note-form">
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              className={`pill ${newNoteCategory === 'footnote' ? 'active' : ''}`}
              onClick={() => setNewNoteCategory('footnote')}
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              Note de bas de page (numérotée)
            </button>
            <button
              type="button"
              className={`pill ${newNoteCategory === 'margin' ? 'active' : ''}`}
              onClick={() => setNewNoteCategory('margin')}
              style={{ fontSize: 11, padding: '2px 8px' }}
            >
              Pense-bête / Idée libre
            </button>
          </div>
          <textarea
            ref={inputRef}
            className="note-textarea"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder={newNoteCategory === 'footnote' ? "Contenu de la note de bas de page…" : "Idée, rappel d'intrigue ou pense-bête…"}
            rows={3}
            autoFocus
          />
          <div className="note-form-actions">
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={handleAdd}>
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="notes-list">
        {displayedNotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconPaperclip size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-text">
              {activeTab === 'footnotes'
                ? 'Aucune note de bas de page pour ce chapitre.'
                : 'Aucun pense-bête pour ce chapitre.'}
            </div>
          </div>
        ) : (
          displayedNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isEditing={editingId === note.id}
              onStartEdit={() => setEditingId(note.id)}
              onSave={(content) => handleUpdate(note.id, content)}
              onCancel={() => setEditingId(null)}
              onDelete={() => handleDelete(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── NoteItem ──

function NoteItem({
  note,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  note: EditableNote;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (content: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [editText, setEditText] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editText.trim()) {
      onSave(editText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="note-card editing">
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className="note-card-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <IconCheck size={14} strokeWidth={2.5} />
            <span>Enregistrer</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="note-card">
      <div className="note-card-header">
        <span className="note-key">{note.key}</span>
        <div className="note-card-tools">
          <button className="note-tool-btn" onClick={onStartEdit} title="Modifier" aria-label="Modifier la note">
            <IconEdit size={13} />
          </button>
          <button className="note-tool-btn delete" onClick={onDelete} title="Supprimer" aria-label="Supprimer la note">
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="note-card-content">{note.content}</div>
    </div>
  );
}
