import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ProcessedChapter } from '../utils/linearizeManuscript';
import { ExportTheme } from '../types/theme';
import { PageSetup } from '../types/exportSettings';
import { HeaderFooterDecoration } from './pageDecorations';

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
  const styles = StyleSheet.create({
    page: {
      paddingTop: pageSetup.marginTopMm * 2.83,
      paddingBottom: pageSetup.marginBottomMm * 2.83,
      paddingLeft: pageSetup.marginInsideMm * 2.83,
      paddingRight: pageSetup.marginOutsideMm * 2.83,
      backgroundColor: '#ffffff',
    },
    titleContainer: {
      marginTop: 40,
      marginBottom: 30,
      alignItems: theme.chapterOpening === 'centered-number' ? 'center' : 'flex-start',
    },
    chapterNumber: {
      fontSize: 12,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    chapterTitle: {
      fontSize: 18,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
    },
    ornament: {
      fontSize: 14,
      color: theme.colors.accent,
      marginVertical: 10,
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
    <Page size="A4" style={styles.page}>
      <HeaderFooterDecoration theme={theme} bookTitle={bookTitle} authorName={authorName} />

      <View style={styles.titleContainer}>
        {includeChapterNumbers && (
          <Text style={styles.chapterNumber}>Chapitre {index + 1}</Text>
        )}
        <Text style={styles.chapterTitle}>{chapter.title}</Text>
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
