import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../types/bookMeta';
import { ExportSettings } from '../types/exportSettings';
import { ExportHistoryEntry } from '../types/job';

const SETTINGS_KEY_PREFIX = 'atelier_export_settings_';

export const DEFAULT_PAGE_SETUP = {
  format: 'A4' as const,
  orientation: 'portrait' as const,
  marginTopMm: 20,
  marginBottomMm: 20,
  marginInsideMm: 25,
  marginOutsideMm: 20,
  bleedMm: 0,
  fontSizePt: 11,
  lineHeight: 1.5,
  firstLineIndentMm: 5,
  justify: true,
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  id: 'default',
  themeId: 'classique',
  page: DEFAULT_PAGE_SETUP,
  includeToc: true,
  includeChapterNumbers: true,
  startNewPagePerChapter: true,
  updatedAt: Date.now(),
};

export function loadExportSettings(manuscriptId: string): ExportSettings {
  if (typeof window === 'undefined') return DEFAULT_EXPORT_SETTINGS;
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${manuscriptId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return DEFAULT_EXPORT_SETTINGS;
}

export function saveExportSettings(manuscriptId: string, settings: ExportSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${SETTINGS_KEY_PREFIX}${manuscriptId}`, JSON.stringify(settings));
  } catch {}
}

const META_KEY_PREFIX = 'atelier_book_meta_';
const HISTORY_KEY_PREFIX = 'atelier_export_history_';

export function loadBookMetadata(manuscriptId: string, fallbackTitle: string = 'Mon Livre'): {
  metadata: BookMetadata;
  sections: FrontBackMatterSection[];
  coverConfig: CoverConfig;
} {
  const defaultRes = {
    metadata: { title: fallbackTitle, authorName: 'Auteur', copyrightYear: new Date().getFullYear() },
    sections: [],
    coverConfig: { mode: 'none' as const, background: { type: 'color' as const, value: '#8a5a34' }, titleColor: '#ffffff' },
  };
  if (typeof window === 'undefined') return defaultRes;
  try {
    const raw = localStorage.getItem(`${META_KEY_PREFIX}${manuscriptId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        metadata: { ...defaultRes.metadata, ...parsed.metadata },
        sections: parsed.sections || [],
        coverConfig: { ...defaultRes.coverConfig, ...parsed.coverConfig },
      };
    }
  } catch {}
  return defaultRes;
}

export function saveBookMetadata(
  manuscriptId: string,
  metadata: BookMetadata,
  sections: FrontBackMatterSection[],
  coverConfig: CoverConfig
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${META_KEY_PREFIX}${manuscriptId}`,
      JSON.stringify({ metadata, sections, coverConfig })
    );
  } catch {}
}

export function loadExportHistory(manuscriptId: string): ExportHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${manuscriptId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addExportHistoryEntry(manuscriptId: string, entry: ExportHistoryEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadExportHistory(manuscriptId);
    const updated = [entry, ...existing].slice(0, 20); // Keep last 20
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${manuscriptId}`, JSON.stringify(updated));
  } catch {}
}
