export type PageFormat = 'A4' | 'A5' | '6x9in' | 'pocket';

export type ThemeId =
  | 'classique'
  | 'fantasy'
  | 'sf'
  | 'polar'
  | 'thriller'
  | 'essai'
  | 'biographie'
  | 'jeunesse'
  | 'minimaliste'
  | 'prestige';

export interface PageSetup {
  format: PageFormat;
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginBottomMm: number;
  marginInsideMm: number; // relieure
  marginOutsideMm: number;
  bleedMm: number; // fonds perdus POD
  fontSizePt: number;
  lineHeight: number;
  firstLineIndentMm: number;
  justify: boolean;
}

export interface CustomThemeOverrides {
  accentColor?: string;
  textColor?: string;
  ruleColor?: string;
  chapterTitleAlignment?: 'centered' | 'left-aligned';
  showOrnament?: boolean;
}

export interface ExportSettings {
  id: string;
  themeId: ThemeId;
  customTheme?: CustomThemeOverrides;
  page: PageSetup;
  includeToc: boolean;
  includeChapterNumbers: boolean;
  startNewPagePerChapter: boolean;
  updatedAt: number;
}
