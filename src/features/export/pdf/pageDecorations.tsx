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
      top: 25,
      left: 40,
      right: 40,
      fontSize: 8,
      fontFamily: theme.fonts.folio,
      color: theme.colors.ruleLine,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.ruleLine,
      paddingBottom: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 25,
      left: 40,
      right: 40,
      fontSize: 9,
      fontFamily: theme.fonts.folio,
      color: theme.colors.text,
      textAlign: theme.folioStyle === 'centered' ? 'center' : 'right',
    },
  });

  return (
    <>
      {theme.headerStyle !== 'none' && (
        <View style={styles.header} fixed>
          <Text>{authorName}</Text>
          <Text>{bookTitle}</Text>
        </View>
      )}
      {theme.folioStyle !== 'none' && (
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            pageNumber > 1 ? `${pageNumber}` : ''
          }
          fixed
        />
      )}
    </>
  );
}
