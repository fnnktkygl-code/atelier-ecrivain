/**
 * NotesPanel — Editable notes panel
 *
 * Features:
 * - Add notes manually
 * - Edit existing notes inline
 * - Delete notes
 * - AI-generated notes marked with badge
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import type { EditableNote, ManuscriptAction } from '@/types/editor';

interface NotesPanelProps {
  notes: EditableNote[];
  chapterIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotesPanel({ notes, chapterIndex, dispatch, isOpen, onClose }: NotesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleAdd = useCallback(() => {
    if (!newNoteContent.trim()) return;
    dispatch({ type: 'ADD_NOTE', chapterIndex, content: newNoteContent.trim() });
    setNewNoteContent('');
    setShowAddForm(false);
  }, [newNoteContent, chapterIndex, dispatch]);

  const handleUpdate = useCallback(
    (noteId: string, content: string) => {
      dispatch({ type: 'UPDATE_NOTE', chapterIndex, noteId, content });
      setEditingId(null);
    },
    [chapterIndex, dispatch]
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      dispatch({ type: 'DELETE_NOTE', chapterIndex, noteId });
    },
    [chapterIndex, dispatch]
  );

  return (
    <div className={`notes-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="review-panel-header">
        <h3>
          Notes
          {notes.length > 0 && (
            <span className="review-count">{notes.length}</span>
          )}
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-icon"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ width: 32, height: 32, fontSize: 16 }}
            title="Ajouter une note"
          >
            ＋
          </button>
          <button className="btn-icon" onClick={onClose} style={{ width: 32, height: 32, fontSize: 14 }}>
            ✕
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="note-add-form">
          <textarea
            ref={inputRef}
            className="note-textarea"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Écrire une note..."
            rows={3}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)} style={{ fontSize: 12, padding: '4px 12px' }}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={handleAdd} style={{ fontSize: 12, padding: '4px 12px' }}>
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="empty-state-icon" style={{ fontSize: 28 }}>📎</div>
            <div className="empty-state-text" style={{ fontSize: 13 }}>
              Aucune note pour ce chapitre. Cliquez ＋ pour en ajouter.
            </div>
          </div>
        ) : (
          notes.map((note) => (
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
  const [editContent, setEditContent] = useState(note.content);
  const [isHovered, setIsHovered] = useState(false);

  const handleStartEdit = () => {
    setEditContent(note.content);
    onStartEdit();
  };

  const handleSave = () => {
    if (editContent.trim()) {
      onSave(editContent.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) handleSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="note-item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-item-header">
        <span className="note-key">{note.key}</span>
        {note.source === 'ai' && <span className="note-ai-badge">IA</span>}
        {note.source === 'manual' && <span className="note-manual-badge">Manuel</span>}
      </div>

      {isEditing ? (
        <div className="note-edit-area">
          <textarea
            className="note-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: 11, padding: '3px 10px' }}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={handleSave} style={{ fontSize: 11, padding: '3px 10px' }}>
              Sauver
            </button>
          </div>
        </div>
      ) : (
        <div className="note-content" onClick={handleStartEdit} title="Cliquer pour modifier">
          {note.content}
        </div>
      )}

      {/* Actions */}
      {isHovered && !isEditing && (
        <div className="note-actions">
          <button className="editor-block-action-btn" onClick={handleStartEdit} title="Modifier">
            ✏️
          </button>
          <button className="editor-block-action-btn delete" onClick={onDelete} title="Supprimer">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
