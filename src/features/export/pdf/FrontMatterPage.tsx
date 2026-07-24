import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { FrontBackMatterSection } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';
import { HeaderFooterDecoration } from './pageDecorations';

export function FrontMatterPage({
  section,
  theme,
  bookTitle,
  authorName,
}: {
  section: FrontBackMatterSection;
  theme: ExportTheme;
  bookTitle?: string;
  authorName?: string;
}) {
  const styles = StyleSheet.create({
    page: {
      paddingTop: 50,
      paddingBottom: 50,
      paddingHorizontal: 40,
      backgroundColor: '#ffffff',
    },
    // BUG FIXED: these were previously set on the wrapping <View>, not on the
    // <Text> that actually renders the words. react-pdf only inherits a limited
    // set of text properties down through Views, so the section title was
    // rendering in the default font/color instead of the theme's heading font
    // and accent color — every other page (TitlePage, CopyrightPage, ChapterSection)
    // applies its text styles directly to the <Text> node, so preface/postface
    // pages looked visibly inconsistent with the rest of the book.
    title: {
      fontSize: 22,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 20,
      textAlign: theme.titlePageLayout === 'centered' ? 'center' : 'left',
    },
    content: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      lineHeight: 1.6,
      textAlign: 'justify',
    },
  });

  return (
    <Page size="A4" style={styles.page}>
      {/* BUG FIXED: preface/avant-propos/postface/annexe pages previously had no
          header, footer, or page number at all, while chapters did — giving the
          book an inconsistent, unfinished look wherever front/back matter was used. */}
      <HeaderFooterDecoration theme={theme} bookTitle={bookTitle || ''} authorName={authorName || ''} />
      <View>
        <Text style={styles.title}>{section.title}</Text>
      </View>
      <View>
        <Text style={styles.content}>{section.content || '(Aucun contenu)'}</Text>
      </View>
    </Page>
  );
}
