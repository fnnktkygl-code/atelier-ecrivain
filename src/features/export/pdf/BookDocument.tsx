import React from 'react';
import { Document } from '@react-pdf/renderer';
import { ProcessedChapter } from '../utils/linearizeManuscript';
import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../types/bookMeta';
import { ExportSettings } from '../types/exportSettings';
import { ExportTheme } from '../types/theme';
import { CoverPage } from './CoverPage';
import { TitlePage } from './TitlePage';
import { CopyrightPage } from './CopyrightPage';
import { DedicacePage } from './DedicacePage';
import { FrontMatterPage } from './FrontMatterPage';
import { ChapterSection } from './ChapterSection';

export function BookDocument({
  chapters,
  metadata,
  coverConfig,
  settings,
  theme,
  frontBackSections = [],
}: {
  chapters: ProcessedChapter[];
  metadata: BookMetadata;
  coverConfig: CoverConfig;
  settings: ExportSettings;
  theme: ExportTheme;
  frontBackSections?: FrontBackMatterSection[];
}) {
  const frontSections = frontBackSections.filter((s) => s.placement === 'front');
  const backSections = frontBackSections.filter((s) => s.placement === 'back');

  return (
    <Document title={metadata.title} author={metadata.authorName}>
      {/* 1. Cover */}
      {coverConfig.mode !== 'none' && (
        <CoverPage coverConfig={coverConfig} metadata={metadata} theme={theme} />
      )}

      {/* 2. Title Page */}
      <TitlePage metadata={metadata} theme={theme} />

      {/* 3. Copyright Page */}
      <CopyrightPage metadata={metadata} theme={theme} />

      {/* 4. Dedication */}
      {metadata.dedication && (
        <DedicacePage dedication={metadata.dedication} theme={theme} />
      )}

      {/* 5. Front Matter (Préface, Avant-propos...) */}
      {frontSections.map((sec) => (
        <FrontMatterPage key={sec.id} section={sec} theme={theme} />
      ))}

      {/* 6. Chapters */}
      {chapters.map((ch, idx) => (
        <ChapterSection
          key={ch.id || idx}
          chapter={ch}
          index={idx}
          theme={theme}
          pageSetup={settings.page}
          bookTitle={metadata.title}
          authorName={metadata.authorName}
          includeChapterNumbers={settings.includeChapterNumbers}
        />
      ))}

      {/* 7. Back Matter (Postface, Annexes, Glossaire, Bio...) */}
      {backSections.map((sec) => (
        <FrontMatterPage key={sec.id} section={sec} theme={theme} />
      ))}
    </Document>
  );
}
