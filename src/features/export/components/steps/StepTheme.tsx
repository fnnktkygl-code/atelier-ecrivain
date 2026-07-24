'use client';

import React from 'react';
import { ThemeId } from '../../types/exportSettings';
import { THEME_REGISTRY } from '../../themes/registry';

interface StepThemeProps {
  selectedThemeId: ThemeId;
  onChange: (themeId: ThemeId) => void;
}

export function StepTheme({ selectedThemeId, onChange }: StepThemeProps) {
  const themes = Object.values(THEME_REGISTRY);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        4. Choix du Thème Éditorial (Typographie & Design)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(180px, 1fr) )', gap: 12 }}>
        {themes.map((t) => {
          const isSelected = selectedThemeId === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                background: isSelected ? 'var(--accent-glow)' : 'var(--surface-2)',
                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.label}</span>
                  {t.ornamentGlyph && <span style={{ fontSize: 14 }}>{t.ornamentGlyph}</span>}
                </div>

                <div style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-soft)', marginBottom: 8 }}>
                  Typo : {t.fonts.heading} / {t.fonts.body}
                </div>
              </div>

              {/* Theme mini page preview */}
              <div
                style={{
                  height: 60,
                  background: '#ffffff',
                  borderRadius: 6,
                  padding: 8,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  color: t.colors.text,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: t.titlePageLayout === 'centered' ? 'center' : 'flex-start',
                  textAlign: t.titlePageLayout === 'centered' ? 'center' : 'left',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700, color: t.colors.accent }}>
                  {t.id.toUpperCase()}
                </div>
                <div style={{ fontSize: 7, opacity: 0.6, marginTop: 2 }}>
                  Chapitre I — {t.chapterOpening}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
