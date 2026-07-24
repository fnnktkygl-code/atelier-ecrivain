export interface BookMetadata {
  title: string;
  subtitle?: string;
  authorName: string;
  penName?: string;
  epigraph?: string;
  dedication?: string;
  acknowledgments?: string;
  backCoverBlurb?: string;
  isbn?: string;
  publisher?: string;
  publisherLogoUrl?: string;
  copyrightYear?: number;
  legalNotice?: string;
  authorBio?: string;
}

export interface FrontBackMatterSection {
  id: string;
  placement: 'front' | 'back';
  kind: 'preface' | 'foreword' | 'afterword' | 'appendix' | 'glossary' | 'custom';
  title: string;
  content: string;
  order: number;
}

export interface CoverConfig {
  mode: 'imported' | 'generated' | 'none';
  imageUrl?: string;
  background?: { type: 'color' | 'gradient'; value: string };
  titleColor?: string;
  fontFamily?: string;
  illustrationUrl?: string;
  hideTextOverlay?: boolean; // Toggles whether title/subtitle/author text is rendered over background
  aiGeneration?: { prompt: string; provider: 'imagen-4' | 'procedural-fallback' } | null;
}
