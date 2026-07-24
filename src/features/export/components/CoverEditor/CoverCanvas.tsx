import React, { useState, useEffect } from 'react';
import { CoverConfig, BookMetadata } from '../../types/bookMeta';

export function CoverCanvas({
  coverConfig,
  metadata,
}: {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
}) {
  const [hasError, setHasError] = useState(false);
  const bg = coverConfig.background?.value || '#8a5a34';
  const titleColor = coverConfig.titleColor || '#ffffff';

  // Reset error when illustrationUrl changes
  useEffect(() => {
    setHasError(false);
  }, [coverConfig.illustrationUrl]);

  if (coverConfig.mode === 'imported' && coverConfig.imageUrl && !coverConfig.illustrationUrl) {
    return (
      <div style={{ width: 220, height: 320, borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverConfig.imageUrl} alt="Couverture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  const showIllustration = Boolean(coverConfig.illustrationUrl && !hasError);

  return (
    <div
      style={{
        width: 220,
        height: 320,
        borderRadius: 8,
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        color: titleColor,
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      {/* Background AI Illustration */}
      {showIllustration && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverConfig.illustrationUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1,
            }}
          />
          {/* Dark Overlay for typography readability */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.85) 100%)',
              zIndex: 2,
            }}
          />
        </>
      )}

      {/* Title & Subtitle */}
      <div style={{ zIndex: 3, position: 'relative', marginTop: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'serif', textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
          {metadata.title || 'Titre du Livre'}
        </div>
        {metadata.subtitle && (
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6, fontFamily: 'sans-serif', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {metadata.subtitle}
          </div>
        )}
      </div>

      {/* Author Name */}
      <div style={{ zIndex: 3, position: 'relative', fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 12, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
        {metadata.authorName || 'Auteur'}
      </div>
    </div>
  );
}
