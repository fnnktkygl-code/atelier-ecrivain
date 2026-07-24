'use client';

import React from 'react';
import { CoverConfig, BookMetadata } from '../../types/bookMeta';
import { CoverCanvas } from '../CoverEditor/CoverCanvas';
import { CoverControls } from '../CoverEditor/CoverControls';

interface StepCoverProps {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
  onChange: (updated: CoverConfig) => void;
}

export function StepCover({ coverConfig, metadata, onChange }: StepCoverProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        3. Design de la Couverture
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Live Canvas Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>Aperçu de la Couverture</div>
          <CoverCanvas coverConfig={coverConfig} metadata={metadata} />
        </div>

        {/* Controls */}
        <div>
          <CoverControls coverConfig={coverConfig} metadata={metadata} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
