import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { ExportTheme } from '../types/theme';

export function HeaderFooterDecoration({
  theme,
  bookTitle,
  authorName,
}: {
  theme: ExportTheme;
  bookTitle: string;
  authorName: string;
}) {
  const styles = StyleSheet.create({
    header: {
      position: 'absolute',
      top: 18,
      left: 40,
      right: 40,
      fontSize: 8,
      fontFamily: theme.fonts.folio || 'Helvetica',
      color: theme.colors.ruleLine || '#999999',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 0.75,
      borderBottomColor: theme.colors.ruleLine || '#cccccc',
      paddingBottom: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 40,
      right: 40,
      fontSize: 9,
      fontFamily: theme.fonts.folio || 'Helvetica',
      color: theme.colors.text || '#333333',
      textAlign: theme.folioStyle === 'centered' ? 'center' : 'right',
    },
  });

  return (
    <>
      <View style={styles.header} fixed>
        <Text style={{ fontSize: 8, fontFamily: theme.fonts.heading, color: theme.colors.accent }}>
          {authorName || 'Auteur'}
        </Text>
        <Text style={{ fontSize: 8, fontFamily: theme.fonts.heading, color: theme.colors.text, opacity: 0.7 }}>
          {bookTitle || 'Manuscrit'}
        </Text>
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber }) => (pageNumber > 1 ? `— ${pageNumber} —` : '')}
        fixed
      />
    </>
  );
}
