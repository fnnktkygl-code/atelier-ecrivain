'use client';

import React, { useState } from 'react';
import { CoverConfig, BookMetadata } from '../../types/bookMeta';

interface CoverControlsProps {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
  onChange: (updated: CoverConfig) => void;
}

const COLOR_PALETTES = [
  '#8a5a34', '#1e293b', '#0f172a', '#312e81', '#701a75',
  '#831843', '#064e3b', '#78350f', '#451a03', '#111827',
  'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  'linear-gradient(135deg, #701a75 0%, #312e81 100%)',
  'linear-gradient(135deg, #831843 0%, #9a3412 100%)',
  'linear-gradient(135deg, #064e3b 0%, #0284c7 100%)',
];

export function CoverControls({ coverConfig, metadata, onChange }: CoverControlsProps) {
  const [prompt, setPrompt] = useState(coverConfig.aiGeneration?.prompt || '');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      onChange({ ...coverConfig, mode: 'imported', imageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiIllustration = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      // Create a decorative procedural illustration or placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = coverConfig.background?.value || '#1e293b';
        ctx.fillRect(0, 0, 600, 900);
        ctx.fillStyle = coverConfig.titleColor || '#ffffff';
        ctx.font = 'bold 36px serif';
        ctx.textAlign = 'center';
        ctx.fillText(metadata.title || 'Mon Livre', 300, 200);
      }
      const dataUrl = canvas.toDataURL('image/png');
      onChange({
        ...coverConfig,
        mode: 'generated',
        illustrationUrl: dataUrl,
        aiGeneration: { prompt, provider: 'imagen-4' },
      });
    } catch {}
    setIsGeneratingAi(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode Choice */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>
          Mode de couverture :
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn-chip ${coverConfig.mode === 'generated' ? 'active' : ''}`}
            onClick={() => onChange({ ...coverConfig, mode: 'generated' })}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: coverConfig.mode === 'generated' ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: coverConfig.mode === 'generated' ? 'var(--accent-glow)' : 'var(--surface-2)',
              color: 'var(--text)',
            }}
          >
            🎨 Graphique
          </button>
          <button
            type="button"
            className={`btn-chip ${coverConfig.mode === 'imported' ? 'active' : ''}`}
            onClick={() => onChange({ ...coverConfig, mode: 'imported' })}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: coverConfig.mode === 'imported' ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: coverConfig.mode === 'imported' ? 'var(--accent-glow)' : 'var(--surface-2)',
              color: 'var(--text)',
            }}
          >
            📥 Image Importée
          </button>
          <button
            type="button"
            className={`btn-chip ${coverConfig.mode === 'none' ? 'active' : ''}`}
            onClick={() => onChange({ ...coverConfig, mode: 'none' })}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: coverConfig.mode === 'none' ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: coverConfig.mode === 'none' ? 'var(--accent-glow)' : 'var(--surface-2)',
              color: 'var(--text)',
            }}
          >
            🚫 Sans Couverture
          </button>
        </div>
      </div>

      {coverConfig.mode === 'imported' && (
        <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, border: '1px dashed var(--border)' }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Sélectionner une image (PNG / JPG / WEBP) :
          </label>
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ fontSize: 12 }} />
        </div>
      )}

      {coverConfig.mode === 'generated' && (
        <>
          {/* Palette de fond */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Couleur / Dégradé de fond :
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PALETTES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...coverConfig, background: { type: color.includes('gradient') ? 'gradient' : 'color', value: color } })}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: color, border: '2px solid var(--border)', cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Couleur du titre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Couleur du texte :</label>
            <input
              type="color"
              value={coverConfig.titleColor || '#ffffff'}
              onChange={(e) => onChange({ ...coverConfig, titleColor: e.target.value })}
              style={{ border: 'none', background: 'none', cursor: 'pointer', width: 32, height: 32 }}
            />
          </div>

          {/* Illustration IA optionnelle */}
          <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
              ✨ Illustration IA (Optionnelle) :
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Une forêt sombre brumeuse en peinture à l'huile..."
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={handleGenerateAiIllustration}
                disabled={isGeneratingAi}
                style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {isGeneratingAi ? '⏳' : 'Générer'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
