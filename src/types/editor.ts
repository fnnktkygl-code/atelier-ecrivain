/**
 * Types pour l'éditeur de manuscrit interactif
 */

/** Bloc de texte individuel dans l'éditeur */
export interface TextBlock {
  id: string;
  content: string;
  type: 'paragraph' | 'heading' | 'quote';
  source: 'original' | 'dictation' | 'manual';
  createdAt: number; // timestamp
}

/** Note éditable */
export interface EditableNote {
  id: string;
  key: string; // numéro affiché (1, 2, 3...)
  content: string;
  source: 'original' | 'ai' | 'manual';
  attachedToBlockId?: string;
}

/** Suggestion IA en attente de révision */
export interface PendingReview {
  id: string;
  type: 'rature' | 'correction';
  /** Texte original dans le manuscrit */
  original: string;
  /** Suggestion de remplacement */
  suggestion: string;
  /** Explication de l'IA */
  explanation?: string;
  /** Source/référence pour les corrections */
  source?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/** Chapitre éditable */
export interface EditableChapter {
  id: string;
  title: string;
  blocks: TextBlock[];
  notes: EditableNote[];
  pendingReviews: PendingReview[];
}

/** État complet du manuscrit */
export interface ManuscriptState {
  chapters: EditableChapter[];
  activeChapterIndex: number;
  /** Index du bloc après lequel insérer la dictée (null = fin) */
  insertionPoint: number | null;
  isDirty: boolean;
  lastSaved: number | null; // timestamp
}

/** Actions possibles sur le manuscrit */
export type ManuscriptAction =
  // Blocks
  | { type: 'UPDATE_BLOCK'; chapterIndex: number; blockId: string; content: string }
  | { type: 'ADD_BLOCK'; chapterIndex: number; afterBlockId: string | null; content?: string; blockType?: TextBlock['type'] }
  | { type: 'DELETE_BLOCK'; chapterIndex: number; blockId: string }
  | { type: 'MOVE_BLOCK'; chapterIndex: number; fromIndex: number; toIndex: number }
  | { type: 'SPLIT_BLOCK'; chapterIndex: number; blockId: string; splitAt: number }
  | { type: 'MERGE_BLOCKS'; chapterIndex: number; blockId: string; withPreviousId: string }
  | { type: 'INSERT_DICTATION'; chapterIndex: number; afterBlockIndex: number | null; blocks: TextBlock[] }
  // Chapters
  | { type: 'ADD_CHAPTER'; title: string }
  | { type: 'RENAME_CHAPTER'; chapterIndex: number; title: string }
  | { type: 'DELETE_CHAPTER'; chapterIndex: number }
  | { type: 'MOVE_CHAPTER'; fromIndex: number; toIndex: number }
  | { type: 'SET_ACTIVE_CHAPTER'; index: number }
  // Notes
  | { type: 'ADD_NOTE'; chapterIndex: number; content: string; attachedToBlockId?: string }
  | { type: 'UPDATE_NOTE'; chapterIndex: number; noteId: string; content: string }
  | { type: 'DELETE_NOTE'; chapterIndex: number; noteId: string }
  // Reviews
  | { type: 'ADD_REVIEWS'; chapterIndex: number; reviews: PendingReview[] }
  | { type: 'ACCEPT_REVIEW'; chapterIndex: number; reviewId: string }
  | { type: 'REJECT_REVIEW'; chapterIndex: number; reviewId: string }
  // Insertion point
  | { type: 'SET_INSERTION_POINT'; blockIndex: number | null }
  // Persistence
  | { type: 'MARK_SAVED' }
  | { type: 'LOAD_STATE'; state: ManuscriptState };
