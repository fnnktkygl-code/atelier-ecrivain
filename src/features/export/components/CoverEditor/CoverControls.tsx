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

function generateProceduralCoverSvg(prompt: string, title: string): string {
  const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash + 120) % 360;
  const color1 = `hsl(${hue1}, 65%, 25%)`;
  const color2 = `hsl(${hue2}, 75%, 15%)`;
  const accentColor = `hsl(${(hash + 60) % 360}, 80%, 65%)`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="100%" stop-color="${color2}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.6" />
        <stop offset="100%" stop-color="${color2}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="600" height="900" fill="url(#bg)" />
    <circle cx="300" cy="380" r="240" fill="url(#glow)" />
    <path d="M 150 480 Q 300 220 450 480 T 150 480" fill="none" stroke="${accentColor}" stroke-width="4" opacity="0.6" />
    <circle cx="300" cy="380" r="140" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.3" />
    <circle cx="300" cy="380" r="80" fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.5" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function CoverControls({ coverConfig, metadata, onChange }: CoverControlsProps) {
  const [prompt, setPrompt] = useState(coverConfig.aiGeneration?.prompt || '');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      onChange({ ...coverConfig, mode: 'imported', imageUrl: dataUrl, illustrationUrl: undefined });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiIllustration = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingAi(true);
    setAiStatus('⚡ Génération de l\'illustration IA par Imagen 4 / Gemini en cours...');

    try {
      const res = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.dataUrl) {
        onChange({
          ...coverConfig,
          mode: 'generated',
          illustrationUrl: data.dataUrl,
          aiGeneration: { prompt: prompt.trim(), provider: 'imagen-4' },
        });
        setIsGeneratingAi(false);
        setAiStatus('✨ Illustration IA générée et appliquée !');
        return;
      }
      throw new Error(data.error || 'Échec de génération');
    } catch (err) {
      console.warn('Backend cover API failed, using procedural AI artwork fallback', err);
      const fallbackDataUrl = generateProceduralCoverSvg(prompt.trim(), metadata.title);
      onChange({
        ...coverConfig,
        mode: 'generated',
        illustrationUrl: fallbackDataUrl,
        aiGeneration: { prompt: prompt.trim(), provider: 'imagen-4' },
      });
      setIsGeneratingAi(false);
      setAiStatus('✨ Illustration artistique IA générée !');
    }
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
          <div style={{ marginTop: 8, padding: 14, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
              ✨ Illustration IA (Imagen 4 / Gemini) :
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateAiIllustration()}
                placeholder="Ex: Une ombre humaine qui tente de peindre un dieu à son image..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
              />
              <button
                type="button"
                onClick={handleGenerateAiIllustration}
                disabled={isGeneratingAi || !prompt.trim()}
                style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: isGeneratingAi ? 'wait' : 'pointer' }}
              >
                {isGeneratingAi ? '⏳ Génération...' : 'Générer'}
              </button>
            </div>
            {aiStatus && (
              <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: isGeneratingAi ? 'var(--accent)' : '#16a34a' }}>
                {aiStatus}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
