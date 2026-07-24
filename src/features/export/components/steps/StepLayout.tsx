'use client';

import React from 'react';
import { ExportSettings, PageFormat } from '../../types/exportSettings';

interface StepLayoutProps {
  settings: ExportSettings;
  onChange: (updated: ExportSettings) => void;
}

export function StepLayout({ settings, onChange }: StepLayoutProps) {
  const updatePage = (key: string, value: any) => {
    onChange({
      ...settings,
      page: {
        ...settings.page,
        [key]: value,
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        5. Mise en Page & Format d'Impression
      </h3>

      {/* Format & Orientation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Format de Papier
          </label>
          <select
            value={settings.page.format}
            onChange={(e) => updatePage('format', e.target.value as PageFormat)}
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="A5">A5 (148 × 210 mm) — Standard Livre</option>
            <option value="6x9in">6 × 9 pouces (152 × 229 mm) — POD Amazon</option>
            <option value="pocket">Poche (110 × 178 mm)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Orientation
          </label>
          <select
            value={settings.page.orientation}
            onChange={(e) => updatePage('orientation', e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Paysage</option>
          </select>
        </div>
      </div>

      {/* Font & Line Height */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Taille de police ({settings.page.fontSizePt} pt)
          </label>
          <input
            type="range"
            min={9}
            max={15}
            value={settings.page.fontSizePt}
            onChange={(e) => updatePage('fontSizePt', parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Interligne ({settings.page.lineHeight})
          </label>
          <input
            type="range"
            min={1.1}
            max={2.0}
            step={0.1}
            value={settings.page.lineHeight}
            onChange={(e) => updatePage('lineHeight', parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            Marges Intérieures / Reliure ({settings.page.marginInsideMm} mm)
          </label>
          <input
            type="range"
            min={10}
            max={40}
            value={settings.page.marginInsideMm}
            onChange={(e) => updatePage('marginInsideMm', parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Options de document */}
      <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.includeToc}
            onChange={(e) => onChange({ ...settings, includeToc: e.target.checked })}
          />
          Générer une Table des Matières / Sommaire
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.includeChapterNumbers}
            onChange={(e) => onChange({ ...settings, includeChapterNumbers: e.target.checked })}
          />
          Numéroter automatiquement les chapitres (Chapitre 1, Chapitre 2...)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.startNewPagePerChapter}
            onChange={(e) => onChange({ ...settings, startNewPagePerChapter: e.target.checked })}
          />
          Commencer chaque chapitre sur une nouvelle page
        </label>
      </div>
    </div>
  );
}
