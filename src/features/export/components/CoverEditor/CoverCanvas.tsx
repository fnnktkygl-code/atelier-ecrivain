import React from 'react';
import { CoverConfig, BookMetadata } from '../../types/bookMeta';

export function CoverCanvas({
  coverConfig,
  metadata,
}: {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
}) {
  const bg = coverConfig.background?.value || '#8a5a34';
  const titleColor = coverConfig.titleColor || '#ffffff';

  if (coverConfig.mode === 'imported' && coverConfig.imageUrl) {
    return (
      <div style={{ width: 220, height: 320, borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverConfig.imageUrl} alt="Couverture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        height: 320,
        borderRadius: 8,
        background: bg,
        padding: 24,
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
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'serif', marginTop: 20 }}>
          {metadata.title || 'Titre du Livre'}
        </div>
        {metadata.subtitle && (
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6, fontFamily: 'sans-serif' }}>
            {metadata.subtitle}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 16 }}>
        {metadata.authorName || 'Auteur'}
      </div>
    </div>
  );
}
