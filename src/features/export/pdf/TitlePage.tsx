import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { BookMetadata } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';

export function TitlePage({
  metadata,
  theme,
}: {
  metadata: BookMetadata;
  theme: ExportTheme;
}) {
  const styles = StyleSheet.create({
    page: {
      padding: 50,
      backgroundColor: '#ffffff',
      justifyContent: 'space-between',
      alignItems: theme.titlePageLayout === 'left-aligned' ? 'flex-start' : 'center',
    },
    author: {
      fontSize: 14,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      marginTop: 40,
    },
    title: {
      fontSize: 24,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      textAlign: theme.titlePageLayout === 'left-aligned' ? 'left' : 'center',
      marginTop: 20,
    },
    subtitle: {
      fontSize: 12,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      textAlign: theme.titlePageLayout === 'left-aligned' ? 'left' : 'center',
      marginTop: 8,
    },
    publisher: {
      fontSize: 10,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      marginBottom: 30,
    },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={{ alignItems: theme.titlePageLayout === 'left-aligned' ? 'flex-start' : 'center' }}>
        <Text style={styles.author}>{metadata.authorName}</Text>
        <Text style={styles.title}>{metadata.title}</Text>
        {metadata.subtitle && <Text style={styles.subtitle}>{metadata.subtitle}</Text>}
      </View>
      {metadata.publisher && <Text style={styles.publisher}>{metadata.publisher}</Text>}
    </Page>
  );
}
