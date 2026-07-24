import React from 'react';
import { Svg, Defs, LinearGradient, Stop, Rect, View } from '@react-pdf/renderer';

/**
 * react-pdf's `backgroundColor` style only understands solid colors — it does NOT
 * understand CSS `linear-gradient(...)` strings the way a browser does. If you pass
 * a gradient string straight into `backgroundColor`, react-pdf's color parser fails
 * to resolve it and the background silently falls back to nothing (transparent/white),
 * even though the exact same value renders fine in the web preview (CoverCanvas.tsx).
 *
 * This is why gradient cover backgrounds looked correct in the app but were blank/wrong
 * in the exported PDF. `parseCssGradient` + `PageBackgroundFill` fix that by turning
 * the CSS string into a real SVG <linearGradient> that react-pdf can rasterize.
 */

export interface ParsedGradient {
  angleDeg: number;
  stops: { offset: number; color: string }[];
}

const GRADIENT_RE = /^linear-gradient\(([^)]+)\)$/i;

export function isGradientValue(value?: string | null): boolean {
  return !!value && GRADIENT_RE.test(value.trim());
}

/**
 * Parses a subset of CSS `linear-gradient(<angle>deg, <color> <pos>%, <color> <pos>%, ...)`
 * — this covers every value produced by COLOR_PALETTES in CoverControls.tsx.
 * Falls back to a safe top-to-bottom gradient if parsing fails.
 */
export function parseCssGradient(value: string): ParsedGradient {
  const match = value.trim().match(GRADIENT_RE);
  if (!match) {
    return { angleDeg: 180, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#000000' }] };
  }

  const parts = match[1].split(',').map((p) => p.trim());
  let angleDeg = 180; // CSS default direction is "to bottom"
  let colorParts = parts;

  const firstIsAngle = /^-?\d+(\.\d+)?deg$/i.test(parts[0]);
  const firstIsKeyword = /^to\s+(top|bottom|left|right)/i.test(parts[0]);

  if (firstIsAngle) {
    angleDeg = parseFloat(parts[0]);
    colorParts = parts.slice(1);
  } else if (firstIsKeyword) {
    const dir = parts[0].toLowerCase();
    if (dir.includes('bottom')) angleDeg = 180;
    else if (dir.includes('top')) angleDeg = 0;
    else if (dir.includes('right')) angleDeg = 90;
    else if (dir.includes('left')) angleDeg = 270;
    colorParts = parts.slice(1);
  }

  const stops = colorParts.map((part, idx) => {
    const bits = part.trim().split(/\s+/);
    const color = bits[0];
    const pctMatch = bits[1] && bits[1].match(/^(\d+(?:\.\d+)?)%$/);
    const offset = pctMatch
      ? parseFloat(pctMatch[1]) / 100
      : colorParts.length === 1
        ? 0
        : idx / (colorParts.length - 1);
    return { offset, color };
  });

  return { angleDeg, stops };
}

/** Converts a CSS gradient angle to SVG x1/y1/x2/y2 (0..1 space). */
function angleToVector(angleDeg: number) {
  // CSS: 0deg = pointing up ("to top"), increases clockwise.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x1 = 0.5 - Math.cos(rad) / 2;
  const y1 = 0.5 - Math.sin(rad) / 2;
  const x2 = 0.5 + Math.cos(rad) / 2;
  const y2 = 0.5 + Math.sin(rad) / 2;
  return { x1, y1, x2, y2 };
}

/**
 * Full-bleed background fill that works for BOTH solid colors and CSS gradient
 * strings. Use this instead of `style={{ backgroundColor: value }}` anywhere a
 * cover/background color coming from CoverConfig.background is rendered in a PDF.
 */
export function PageBackgroundFill({
  value,
  gradientId,
}: {
  value: string;
  gradientId: string;
}) {
  if (!isGradientValue(value)) {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: value || '#8a5a34',
        }}
      />
    );
  }

  const { angleDeg, stops } = parseCssGradient(value);
  const { x1, y1, x2, y2 } = angleToVector(angleDeg);

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={gradientId} x1={x1} y1={y1} x2={x2} y2={y2}>
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={1} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={1} height={1} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/** Simple semi-transparent scrim (top darker, bottom darker, middle lighter) used
 * to guarantee title/author legibility over an illustrated cover image. Mirrors
 * the overlay used in the web preview (CoverCanvas.tsx) so the PDF matches what
 * the user saw while editing. */
export function ReadabilityScrim({ gradientId }: { gradientId: string }) {
  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={gradientId} x1={0} y1={0} x2={0} y2={1}>
          <Stop offset={0} stopColor="#000000" stopOpacity={0.75} />
          <Stop offset={0.5} stopColor="#000000" stopOpacity={0.25} />
          <Stop offset={1} stopColor="#000000" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={1} height={1} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/** Validates that a src is something react-pdf's <Image> can actually load
 * (data URL or absolute http(s) URL). react-pdf throws and aborts the WHOLE
 * document render if given `undefined`, an empty string, or a malformed value —
 * so we guard against that here instead of letting one bad cover crash the export. */
export function isRenderableImageSrc(src?: string | null): src is string {
  if (!src || typeof src !== 'string') return false;
  return src.startsWith('data:image/') || /^https?:\/\//i.test(src);
}
