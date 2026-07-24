import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { ExportTheme } from '../types/theme';

export function HeaderFooterDecoration({
  theme,
  bookTitle,
  authorName,
  showFolio = true,
}: {
  theme: ExportTheme;
  bookTitle: string;
  authorName: string;
  /** Set to false on a section's very first page (e.g. chapter opener) if your
   * theme hides the folio there. Defaults to true. */
  showFolio?: boolean;
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

  // BUG FIXED: the previous check was `pageNumber > 1`, where `pageNumber` is the
  // GLOBAL physical page number of the whole rendered document (react-pdf gives
  // the running total across every <Page>, not a per-section counter). By the
  // time the first chapter page is reached, `pageNumber` is already well past 1
  // (cover + title + copyright + dedication pages came first), so that condition
  // was always true and never actually suppressed anything — it was dead code
  // masquerading as "hide the folio on a chapter's opening page". We now drive
  // that behavior from an explicit `showFolio` prop set by the caller, which
  // actually knows whether the current page is a section's first page.
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

      {showFolio && (
        <Text
          style={styles.footer}
          render={({ pageNumber }) => `— ${pageNumber} —`}
          fixed
        />
      )}
    </>
  );
}
