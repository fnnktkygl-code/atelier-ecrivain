import React from 'react';
import { View, Svg, Rect, Defs, LinearGradient, Stop } from '@react-pdf/renderer';

export function isRenderableImageSrc(src?: string | null): boolean {
  if (!src || typeof src !== 'string') return false;
  const s = src.trim();
  if (!s) return false;
  return s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://');
}

export function PageBackgroundFill({ value, gradientId = 'bg-grad' }: { value: string; gradientId?: string }) {
  if (value.includes('gradient')) {
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1e293b" />
              <Stop offset="100%" stopColor="#0f172a" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: value || '#8a5a34',
      }}
    />
  );
}

export function ReadabilityScrim({ gradientId = 'readability-scrim' }: { gradientId?: string }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0.75} />
            <Stop offset="50%" stopColor="#000000" stopOpacity={0.25} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.85} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
