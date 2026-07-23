import type { EditableChapter } from '@/types/editor';

export interface ProcessedChapter {
  id: string;
  title: string;
  paragraphs: string[];
}

export function linearizeManuscript(chapters: EditableChapter[]): ProcessedChapter[] {
  return chapters.map((ch) => {
    const paragraphs: string[] = [];

    for (const block of ch.blocks) {
      const text = block.content.trim();
      if (text) {
        paragraphs.push(text);
      }
    }

    return {
      id: ch.id,
      title: ch.title || `Chapitre`,
      paragraphs,
    };
  });
}
