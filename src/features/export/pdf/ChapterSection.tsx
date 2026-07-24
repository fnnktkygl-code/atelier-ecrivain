import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ProcessedChapter } from '../utils/linearizeManuscript';
import { ExportTheme } from '../types/theme';
import { PageSetup } from '../types/exportSettings';
import { HeaderFooterDecoration } from './pageDecorations';

function toRoman(num: number): string {
  const lookup: Record<string, number> = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let roman = '';
  for (const i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman || String(num);
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

  const styles = StyleSheet.create({
    page: {
      paddingTop: Math.max(40, pageSetup.marginTopMm * 2.83),
      paddingBottom: Math.max(40, pageSetup.marginBottomMm * 2.83),
      paddingLeft: pageSetup.marginInsideMm * 2.83,
      paddingRight: pageSetup.marginOutsideMm * 2.83,
      backgroundColor: '#ffffff',
    },
    titleContainer: {
      marginTop: 24,
      marginBottom: 28,
      alignItems: isCentered ? 'center' : 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.ruleLine || '#e5e7eb',
      paddingBottom: 16,
    },
    chapterNumberBanner: {
      fontSize: 11,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 8,
      letterSpacing: 2,
      textTransform: 'uppercase',
      fontWeight: 'bold',
    },
    chapterTitle: {
      fontSize: 22,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      textAlign: isCentered ? 'center' : 'left',
      lineHeight: 1.3,
    },
    ornament: {
      fontSize: 16,
      color: theme.colors.accent,
      marginTop: 10,
    },
    firstParagraphWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    dropCap: {
      fontSize: 34,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginRight: 6,
      lineHeight: 1,
      fontWeight: 'bold',
    },
    firstParagraphBody: {
      flex: 1,
      fontSize: pageSetup.fontSizePt,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      lineHeight: pageSetup.lineHeight,
      textAlign: pageSetup.justify ? 'justify' : 'left',
    },
    paragraph: {
      fontSize: pageSetup.fontSizePt,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      lineHeight: pageSetup.lineHeight,
      textAlign: pageSetup.justify ? 'justify' : 'left',
      textIndent: pageSetup.firstLineIndentMm * 2.83,
      marginBottom: 10,
    },
  });

  const romanNumber = toRoman(index + 1);

  return (
    <Page size="A4" style={styles.page}>
      <HeaderFooterDecoration theme={theme} bookTitle={bookTitle} authorName={authorName} />

      {/* Distinguished Chapter Opening */}
      <View style={styles.titleContainer}>
        {includeChapterNumbers && (
          <Text style={styles.chapterNumberBanner}>
            — C H A P I T R E   {romanNumber} —
          </Text>
        )}
        <Text style={styles.chapterTitle}>{chapter.title}</Text>
        {theme.ornamentGlyph && (
          <Text style={styles.ornament}>{theme.ornamentGlyph}</Text>
        )}
      </View>

      {/* Paragraphs with Drop Cap Lettrine for Chapter Start */}
      {chapter.paragraphs.map((p, pIdx) => {
        if (!p || !p.trim()) return null;

        // Apply Drop Cap Lettrine on first paragraph if theme supports it or chapterOpening is drop-cap
        if (pIdx === 0 && (theme.chapterOpening === 'drop-cap' || index >= 0)) {
          const cleanP = p.trim();
          const firstLetter = cleanP.charAt(0);
          const restOfP = cleanP.slice(1);

          return (
            <View key={pIdx} style={styles.firstParagraphWrapper}>
              <Text style={styles.dropCap}>{firstLetter}</Text>
              <Text style={styles.firstParagraphBody}>{restOfP}</Text>
            </View>
          );
        }

        return (
          <Text key={pIdx} style={styles.paragraph}>
            {p}
          </Text>
        );
      })}
    </Page>
  );
}
