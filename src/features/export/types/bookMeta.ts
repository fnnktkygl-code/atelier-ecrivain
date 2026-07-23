export interface BookMetadata {
  title: string;
  subtitle?: string;
  authorName: string;
  penName?: string;
  epigraph?: string; // citation d'ouverture
  dedication?: string;
  acknowledgments?: string;
  backCoverBlurb?: string; // 4e de couverture
  isbn?: string;
  publisher?: string;
  publisherLogoUrl?: string;
  copyrightYear?: number;
  legalNotice?: string;
  authorBio?: string;
}

export interface FrontBackMatterSection {
  id: string;
  placement: 'front' | 'back'; // avant ou après les chapitres
  kind: 'preface' | 'foreword' | 'afterword' | 'appendix' | 'glossary' | 'custom';
  title: string;
  content: string; // markdown simple
  order: number;
}

export interface CoverConfig {
  mode: 'imported' | 'generated' | 'none';
  imageUrl?: string;
  background?: { type: 'color' | 'gradient'; value: string };
  titleColor?: string;
  fontFamily?: string;
  illustrationUrl?: string;
  aiGeneration?: { prompt: string; provider: 'imagen-4' } | null;
}
