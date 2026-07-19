/** Types pour la liseuse (mode lecture) */

export interface ReaderChapter {
  title: string;
  paragraphs: string[];
}

export interface ReaderPage {
  type: 'title' | 'text';
  chapterIndex: number;
  title: string;
  paras?: string[];
  wordCount: number;
}

export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  marginWidth: number;
  fontFamily: 'serif' | 'sans';
  themeIdx: number;
  brightness: number;
  themeAuto: boolean;
  spreadPref: 'single' | 'double' | 'auto';
  pageAnimEnabled: boolean;
  scrollMode: boolean;
}

export interface Bookmark {
  chapterIndex: number;
  ratio: number;
  snippet: string;
  ts: number;
}

export interface Highlight {
  chapterIndex: number;
  text: string;
  ts: number;
}

export interface ProgressRatio {
  chapterIndex: number;
  ratio: number;
}

export type Theme = 'day' | 'sepia' | 'night';

export const THEMES: Theme[] = ['day', 'sepia', 'night'];

export const FONT_STACKS = {
  serif: "'Source Serif 4', Georgia, serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 19,
  lineHeight: 1.85,
  marginWidth: 60,
  fontFamily: 'serif',
  themeIdx: 0,
  brightness: 100,
  themeAuto: false,
  spreadPref: 'auto',
  pageAnimEnabled: true,
  scrollMode: false,
};

export const FONT_MIN = 14;
export const FONT_MAX = 26;
export const READING_WPM = 200;
