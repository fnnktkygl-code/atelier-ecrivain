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
  const bg = coverConfig.background?.value || '#8a5a34';
  const titleColor = coverConfig.titleColor || theme.colors.accent;

  const styles = StyleSheet.create({
    page: {
      padding: 0,
      backgroundColor: bg,
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
      color: titleColor,
      textAlign: 'center',
      marginTop: 60,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: theme.fonts.body,
      color: titleColor,
      textAlign: 'center',
      marginTop: 12,
      opacity: 0.9,
    },
    author: {
      fontSize: 16,
      fontFamily: theme.fonts.heading,
      color: titleColor,
      marginBottom: 60,
    },
    coverImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  });

  const fullImage = coverConfig.mode === 'imported' ? coverConfig.imageUrl : coverConfig.illustrationUrl;

  if (fullImage) {
    return (
      <Page size="A4" style={styles.page}>
        <Image src={fullImage} style={styles.coverImage} />
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
