/** Types pour le manuscrit et l'atelier d'écriture */

export interface Manuscript {
  id: string;
  title: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  chapterCount: number;
  wordCount: number;
}

export interface Chapter {
  index: number;
  title: string;
  /** Paragraphes du jet brut (texte propre) */
  jetBrut: string[];
  /** Ratures / variantes (markdown) */
  ratures: string[];
  /** Corrections & vérifications (markdown) */
  corrections: string[];
  /** Notes & sources, indexées par numéro */
  notes: Record<string, string>;
  /** Notes flottantes (idées à replacer plus tard) */
  floatingNotes: string[];
  /** Pistes ouvertes pour les chapitres suivants */
  openThreads: string[];
  updatedAt: Date;
}

export interface DictationSession {
  id: string;
  chapterIndex: number;
  /** URL du fichier audio dans Firebase Storage */
  audioUrl?: string;
  /** Transcription brute avant structuration */
  rawTranscript: string;
  /** Résultat structuré produit par l'IA */
  structuredOutput?: AIStructuredOutput;
  createdAt: Date;
  /** Durée en secondes */
  duration: number;
}

export interface AIStructuredOutput {
  jetBrut: string[];
  ratures: string[];
  corrections: VerificationItem[];
  notes: Record<string, string>;
  floatingNotes: string[];
}

export interface VerificationItem {
  /** Texte de la vérification */
  text: string;
  /** Statut : confirmé, à nuancer, erreur trouvée */
  status: 'confirmed' | 'caution' | 'error';
  /** Source ou référence vérifiée */
  source?: string;
  /** Suggestion de correction */
  suggestion?: string;
}

/** Types pour la section "Ratures / variantes" du manuscrit */
export interface Rature {
  /** Texte original */
  original: string;
  /** Texte corrigé/reformulé */
  corrected: string;
  /** Explication de la modification */
  explanation: string;
  /** Niveau d'incertitude de la reconstruction */
  uncertainty: 'low' | 'medium' | 'high';
}
