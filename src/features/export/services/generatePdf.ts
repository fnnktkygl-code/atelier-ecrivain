import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { EditableChapter } from '@/types/editor';
import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../types/bookMeta';
import { ExportSettings } from '../types/exportSettings';
import { getTheme } from '../themes/registry';
import { linearizeManuscript } from '../utils/linearizeManuscript';
import { BookDocument } from '../pdf/BookDocument';
import { enrichPdfMetadata } from './pdfMetadata';

export async function generatePdf(
  chapters: EditableChapter[],
  metadata: BookMetadata,
  coverConfig: CoverConfig,
  settings: ExportSettings,
  frontBackSections: FrontBackMatterSection[] = []
): Promise<Blob> {
  const processedChapters = linearizeManuscript(chapters);
  const theme = getTheme(settings.themeId);

  const element = React.createElement(BookDocument, {
    chapters: processedChapters,
    metadata,
    coverConfig,
    settings,
    theme,
    frontBackSections,
  });

  const pdfInstance = pdf(element as any);
  const blob = await pdfInstance.toBlob();
  const buffer = await blob.arrayBuffer();

  const enrichedBytes = await enrichPdfMetadata(buffer, metadata);

  // Return final enriched PDF blob
  return new Blob([enrichedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
