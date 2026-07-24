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

  // Determine active background image (imported image or AI illustration)
  const activeImage = coverConfig.mode === 'imported'
    ? coverConfig.imageUrl
    : coverConfig.illustrationUrl;

  // Reset error when image changes
  useEffect(() => {
    setHasError(false);
  }, [activeImage]);

  const showImage = Boolean(activeImage && !hasError);
  const showText = !coverConfig.hideTextOverlay;

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
      {/* Background Image Layer (Imported or AI Generated) */}
      {showImage && activeImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage}
            alt="Couverture"
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
          {/* Scrim Overlay only if text overlay is active */}
          {showText && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.85) 100%)',
                zIndex: 2,
              }}
            />
          )}
        </>
      )}

      {/* Independent Text Layer (Title, Subtitle, Author) */}
      {showText ? (
        <>
          {/* Title & Subtitle */}
          <div style={{ zIndex: 3, position: 'relative', marginTop: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'serif', textShadow: showImage ? '0 2px 4px rgba(0,0,0,0.9)' : 'none' }}>
              {metadata.title || 'Titre du Livre'}
            </div>
            {metadata.subtitle && (
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6, fontFamily: 'sans-serif', textShadow: showImage ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                {metadata.subtitle}
              </div>
            )}
          </div>

          {/* Author Name */}
          <div style={{ zIndex: 3, position: 'relative', fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 12, textShadow: showImage ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
            {metadata.authorName || 'Auteur'}
          </div>
        </>
      ) : (
        <div style={{ zIndex: 3, position: 'relative', margin: 'auto', fontSize: 10, fontStyle: 'italic', opacity: 0.7, background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4, color: '#fff' }}>
          Texte masqué
        </div>
      )}
    </div>
  );
}
