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
