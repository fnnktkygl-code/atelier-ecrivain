import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ProcessedChapter } from '../utils/linearizeManuscript';
import { ExportTheme } from '../types/theme';
import { PageSetup } from '../types/exportSettings';
import { HeaderFooterDecoration } from './pageDecorations';

function getCleanTitle(title: string): { chapterPrefix?: string; cleanTitle: string } {
  if (!title) return { cleanTitle: '' };
  // Check if title starts with "Chapitre X — " or "Chapitre X: "
  const match = title.match(/^(Chapitre\s+\d+|Chapter\s+\d+)\s*[—:-]?\s*(.*)$/i);
  if (match) {
    return {
      chapterPrefix: match[1],
      cleanTitle: match[2] || match[1],
    };
  }
  return { cleanTitle: title };
}

export function ChapterSection({
  chapter,
  index,
  theme,
  pageSetup,
  bookTitle,
  authorName,
  includeChapterNumbers,
}: {
  chapter: ProcessedChapter;
  index: number;
  theme: ExportTheme;
  pageSetup: PageSetup;
  bookTitle: string;
  authorName: string;
  includeChapterNumbers: boolean;
}) {
  const isCentered = theme.titlePageLayout === 'centered' || theme.chapterOpening === 'centered-number';
  const { chapterPrefix, cleanTitle } = getCleanTitle(chapter.title);

  // NOTE ON MARGINS: `marginInsideMm`/`marginOutsideMm` are applied statically as
  // left/right here regardless of whether the physical page ends up recto or
  // verso. For a true double-sided/print-ready layout, the "inside" (gutter)
  // margin should flip sides on alternating pages. react-pdf can't branch a
  // single <Page>'s padding per physically-wrapped page, so a correct fix needs
  // splitting each chapter into explicit per-page chunks upstream (in
  // linearizeManuscript) rather than letting react-pdf auto-wrap one long Page.
  // Flagging this as a follow-up rather than silently leaving it unaddressed.
  const styles = StyleSheet.create({
    page: {
      paddingTop: Math.max(45, pageSetup.marginTopMm * 2.83),
      paddingBottom: Math.max(45, pageSetup.marginBottomMm * 2.83),
      paddingLeft: pageSetup.marginInsideMm * 2.83,
      paddingRight: pageSetup.marginOutsideMm * 2.83,
      backgroundColor: '#ffffff',
    },
    titleContainer: {
      marginTop: 30,
      marginBottom: 24,
      alignItems: isCentered ? 'center' : 'flex-start',
    },
    chapterNumber: {
      fontSize: 12,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    chapterTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      textAlign: isCentered ? 'center' : 'left',
      lineHeight: 1.3,
    },
    ornament: {
      fontSize: 14,
      color: theme.colors.accent,
      marginTop: 8,
    },
    paragraph: {
      fontSize: pageSetup.fontSizePt,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      lineHeight: pageSetup.lineHeight,
      textAlign: pageSetup.justify ? 'justify' : 'left',
      textIndent: pageSetup.firstLineIndentMm * 2.83,
      marginBottom: 8,
    },
  });

  return (
    <Page size="A4" style={styles.page} wrap>
      <HeaderFooterDecoration theme={theme} bookTitle={bookTitle} authorName={authorName} />

      {/* BUG FIXED: without `wrap={false}`, react-pdf's auto pagination could
          split the chapter number away from its title, or strand the whole
          title block alone at the bottom of a page with the first paragraph
          pushed to the next page — a classic "orphaned heading". Keeping this
          group non-wrapping forces it onto one page as a unit; combined with
          `minPresenceAhead` it also pushes the whole block to the next page if
          there isn't enough room left for at least a first line of body text. */}
      <View style={styles.titleContainer} wrap={false} minPresenceAhead={60}>
        {includeChapterNumbers && (
          <Text style={styles.chapterNumber}>
            {chapterPrefix || `CHAPITRE ${index + 1}`}
          </Text>
        )}
        <Text style={styles.chapterTitle}>{cleanTitle}</Text>
        {theme.ornamentGlyph && (
          <Text style={styles.ornament}>{theme.ornamentGlyph}</Text>
        )}
      </View>

      {chapter.paragraphs.map((p, pIdx) => (
        <Text key={pIdx} style={styles.paragraph}>
          {p}
        </Text>
      ))}
    </Page>
  );
}
