import { PageFormat, ThemeId } from './exportSettings';

export interface ExportJob {
  status: 'idle' | 'preparing' | 'rendering' | 'merging-cover' | 'done' | 'error';
  progress: number; // 0-100
  error?: string;
  resultBlobUrl?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface ExportHistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  themeId: ThemeId;
  pageFormat: PageFormat;
  wordCount: number;
}
