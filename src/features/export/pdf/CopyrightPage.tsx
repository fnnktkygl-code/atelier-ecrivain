import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { BookMetadata } from '../types/bookMeta';
import { ExportTheme } from '../types/theme';

export function CopyrightPage({
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
      justifyContent: 'flex-end',
    },
    text: {
      fontSize: 8.5,
      fontFamily: theme.fonts.body,
      color: '#555555',
      lineHeight: 1.5,
    },
  });

  const year = metadata.copyrightYear || new Date().getFullYear();

  return (
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.text}>© {year} {metadata.authorName}. Tous droits réservés.</Text>
        {metadata.publisher && <Text style={styles.text}>Édité par {metadata.publisher}</Text>}
        {metadata.isbn && <Text style={styles.text}>ISBN : {metadata.isbn}</Text>}
        {metadata.legalNotice && <Text style={[styles.text, { marginTop: 10 }]}>{metadata.legalNotice}</Text>}
      </View>
    </Page>
  );
}
