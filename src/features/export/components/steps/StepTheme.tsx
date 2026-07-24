'use client';

import React from 'react';
import { ThemeId, ExportSettings, CustomThemeOverrides } from '../../types/exportSettings';
import { THEME_REGISTRY, resolveTheme } from '../../themes/registry';

interface StepThemeProps {
  settings: ExportSettings;
  onChange: (updated: ExportSettings) => void;
}

const COLOR_SWATCHES = [
  '#8a5a34', '#4c1d95', '#0284c7', '#dc2626',
  '#b91c1c', '#9a3412', '#047857', '#ea580c', '#525252', '#b45309'
];

export function StepTheme({ settings, onChange }: StepThemeProps) {
  const themes = Object.values(THEME_REGISTRY);
  const activeTheme = resolveTheme(settings.themeId, settings.customTheme);
  const baseTheme = THEME_REGISTRY[settings.themeId] || THEME_REGISTRY.classique;

  const handleSelectBaseTheme = (themeId: ThemeId) => {
    onChange({
      ...settings,
      themeId,
      // Retain or reset custom settings
    });
  };

  const updateCustom = (key: keyof CustomThemeOverrides, value: any) => {
    onChange({
      ...settings,
      customTheme: {
        ...settings.customTheme,
        [key]: value,
      },
    });
  };

  const resetToDefaults = () => {
    onChange({
      ...settings,
      customTheme: undefined,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        4. Choix & Personnalisation du Thème Éditorial
      </h3>

      {/* 1. SELECTION DU THÈME DE BASE */}
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8 }}>
          Sélectionner un Thème de Base :
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(170px, 1fr) )', gap: 10 }}>
          {themes.map((t) => {
            const isSelected = settings.themeId === t.id;
            const themeResolved = resolveTheme(t.id, isSelected ? settings.customTheme : undefined);
            return (
              <div
                key={t.id}
                onClick={() => handleSelectBaseTheme(t.id)}
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
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.8, color: 'var(--text-soft)', marginBottom: 8 }}>
                    Typo : {t.fonts.heading} / {t.fonts.body}
                  </div>
                </div>

                {/* Theme mini page preview */}
                <div
                  style={{
                    height: 54,
                    background: '#ffffff',
                    borderRadius: 6,
                    padding: 8,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    color: themeResolved.colors.text,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: themeResolved.titlePageLayout === 'centered' ? 'center' : 'flex-start',
                    textAlign: themeResolved.titlePageLayout === 'centered' ? 'center' : 'left',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 700, color: themeResolved.colors.accent }}>
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

      {/* 2. PANNEAU DE PERSONNALISATION SUR-MESURE */}
      <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            🛠️ Personnaliser le Thème "{baseTheme.label}" :
          </label>
          {settings.customTheme && (
            <button
              type="button"
              onClick={resetToDefaults}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Réinitialiser les couleurs & styles d'origine
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Couleur d'accentuation */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Couleur d'accentuation (Titres & Ornements) :
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={activeTheme.colors.accent}
                onChange={(e) => updateCustom('accentColor', e.target.value)}
                style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateCustom('accentColor', color)}
                    style={{
                      width: 20, height: 20, borderRadius: '50%', background: color, border: '1px solid var(--border)', cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Couleur du texte de corps */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Couleur du texte principal :
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={activeTheme.colors.text}
                onChange={(e) => updateCustom('textColor', e.target.value)}
                style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeTheme.colors.text}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {/* Alignement des titres */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Position & Alignement des Titres :
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn-chip ${activeTheme.titlePageLayout === 'centered' ? 'active' : ''}`}
                onClick={() => updateCustom('chapterTitleAlignment', 'centered')}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: activeTheme.titlePageLayout === 'centered' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: activeTheme.titlePageLayout === 'centered' ? 'var(--accent-glow)' : 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                ≡ Centré
              </button>
              <button
                type="button"
                className={`btn-chip ${activeTheme.titlePageLayout === 'left-aligned' ? 'active' : ''}`}
                onClick={() => updateCustom('chapterTitleAlignment', 'left-aligned')}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: activeTheme.titlePageLayout === 'left-aligned' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: activeTheme.titlePageLayout === 'left-aligned' ? 'var(--accent-glow)' : 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                ≡ Aligné à gauche
              </button>
            </div>
          </div>

          {/* Interrupteur d'Ornement */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Décorations & Ornements :
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={activeTheme.ornamentGlyph !== undefined}
                onChange={(e) => updateCustom('showOrnament', e.target.checked)}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <span>Afficher le motif d'ornement vectoriel sous le titre</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
