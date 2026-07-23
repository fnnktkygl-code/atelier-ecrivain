import React from 'react';
import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { CoverConfig, BookMetadata } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';

export function CoverPage({
  coverConfig,
  metadata,
  theme,
}: {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
  theme: ExportTheme;
}) {
  const styles = StyleSheet.create({
    page: {
      padding: 0,
      backgroundColor: coverConfig.background?.value || '#faf7f2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 40,
    },
    title: {
      fontSize: 28,
      fontFamily: theme.fonts.heading,
      color: coverConfig.titleColor || theme.colors.accent,
      textAlign: 'center',
      marginTop: 60,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
      textAlign: 'center',
      marginTop: 12,
    },
    author: {
      fontSize: 16,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      marginBottom: 60,
    },
    coverImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  });

  if (coverConfig.mode === 'imported' && coverConfig.imageUrl) {
    return (
      <Page size="A4" style={styles.page}>
        <Image src={coverConfig.imageUrl} style={styles.coverImage} />
      </Page>
    );
  }

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.container}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>{metadata.title}</Text>
          {metadata.subtitle && <Text style={styles.subtitle}>{metadata.subtitle}</Text>}
        </View>
        <Text style={styles.author}>{metadata.authorName}</Text>
      </View>
    </Page>
  );
}
