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
} from '@/components/Shared/Icons';

interface NotesPanelProps {
  notes: EditableNote[];
  chapterIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotesPanel({
  notes,
  chapterIndex,
  dispatch,
  isOpen,
  onClose,
}: NotesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    });
    setNewNoteContent('');
    setShowAddForm(false);
  }, [chapterIndex, dispatch, newNoteContent]);

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
            className="btn-icon"
            onClick={() => setShowAddForm(true)}
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

      {/* Add note form */}
      {showAddForm && (
        <div className="note-form">
          <textarea
            ref={inputRef}
            className="note-textarea"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Écrire une note ou une idée…"
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
        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconPaperclip size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-text">
              Aucune note pour ce chapitre. Cliquez sur « + » pour en consigner une.
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
