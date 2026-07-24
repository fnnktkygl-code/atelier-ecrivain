import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { FrontBackMatterSection } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';

export function FrontMatterPage({
  section,
  theme,
}: {
  section: FrontBackMatterSection;
  theme: ExportTheme;
}) {
  const styles = StyleSheet.create({
    page: {
      paddingTop: 50,
      paddingBottom: 50,
      paddingHorizontal: 40,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
    title: {
      fontSize: 22,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 20,
      textAlign: theme.titlePageLayout === 'centered' ? 'center' : 'left',
    },
    content: {
      fontSize: 11,
      lineHeight: 1.6,
      textAlign: 'justify',
    },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.title}>
        <Text>{section.title}</Text>
      </View>
      <View style={styles.content}>
        <Text>{section.content || '(Aucun contenu)'}</Text>
      </View>
    </Page>
  );
}
