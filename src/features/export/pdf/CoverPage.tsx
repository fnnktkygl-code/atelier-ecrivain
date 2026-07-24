import React from 'react';
import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { CoverConfig, BookMetadata } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';
import { PageBackgroundFill, ReadabilityScrim, isRenderableImageSrc } from './backgroundFill';

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
  const showText = !coverConfig.hideTextOverlay;

  const styles = StyleSheet.create({
    page: {
      padding: 0,
    },
    stage: {
      flex: 1,
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    content: {
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  });

  const rawImage = coverConfig.mode === 'imported' ? coverConfig.imageUrl : coverConfig.illustrationUrl;
  const hasUsableImage = isRenderableImageSrc(rawImage);

  if (hasUsableImage) {
    return (
      <Page size="A4" style={styles.page}>
        <View style={styles.stage}>
          <Image src={rawImage as string} style={styles.coverImage} />
          {showText && (
            <>
              <ReadabilityScrim gradientId="cover-scrim" />
              <View style={styles.content}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.title}>{metadata.title || 'Titre du Livre'}</Text>
                  {metadata.subtitle && <Text style={styles.subtitle}>{metadata.subtitle}</Text>}
                </View>
                <Text style={styles.author}>{metadata.authorName || 'Auteur'}</Text>
              </View>
            </>
          )}
        </View>
      </Page>
    );
  }

  // Solid/gradient background cover
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.stage}>
        <PageBackgroundFill value={bg} gradientId="cover-bg" />
        {showText && (
          <View style={styles.content}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.title}>{metadata.title || 'Titre du Livre'}</Text>
              {metadata.subtitle && <Text style={styles.subtitle}>{metadata.subtitle}</Text>}
            </View>
            <Text style={styles.author}>{metadata.authorName || 'Auteur'}</Text>
          </View>
        )}
      </View>
    </Page>
  );
}
