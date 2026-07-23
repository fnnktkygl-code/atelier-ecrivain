import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { ExportTheme } from '../types/theme';

export function DedicacePage({
  dedication,
  theme,
}: {
  dedication: string;
  theme: ExportTheme;
}) {
  const styles = StyleSheet.create({
    page: {
      padding: 50,
      backgroundColor: '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      fontStyle: 'italic',
      color: theme.colors.text,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 1.6,
    },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.text}>{dedication}</Text>
      </View>
    </Page>
  );
}
