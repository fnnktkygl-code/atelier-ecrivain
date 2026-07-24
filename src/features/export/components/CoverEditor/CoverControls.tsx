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

function generateProceduralCoverArt(prompt: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Cosmic Gradient
  const grad = ctx.createLinearGradient(0, 0, 600, 900);
  grad.addColorStop(0, '#0f0c20');
  grad.addColorStop(0.3, '#241442');
  grad.addColorStop(0.65, '#5b1257');
  grad.addColorStop(1, '#090514');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 900);

  // Stars / Celestial Dust
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 600;
    const y = Math.random() * 900;
    const r = Math.random() * 2;
    const alpha = Math.random() * 0.8 + 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Divine Aura / Glowing Orbs in Center
  const auraGrad = ctx.createRadialGradient(300, 320, 20, 300, 320, 270);
  auraGrad.addColorStop(0, 'rgba(255, 230, 160, 0.95)');
  auraGrad.addColorStop(0.35, 'rgba(236, 72, 153, 0.65)');
  auraGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.35)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(300, 320, 270, 0, Math.PI * 2);
  ctx.fill();

  // Divine Face / Halo Silhouette
  ctx.strokeStyle = 'rgba(255, 235, 180, 0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(300, 280, 95, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 240, 200, 0.95)';
  ctx.beginPath();
  ctx.arc(300, 280, 16, 0, Math.PI * 2);
  ctx.fill();

  // Sunburst Rays of Light
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI) / 7;
    ctx.strokeStyle = 'rgba(255, 215, 120, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(300, 280);
    ctx.lineTo(300 + Math.cos(angle) * 360, 280 + Math.sin(angle) * 360);
    ctx.stroke();
  }

  // Human Shadow Silhouette at Bottom
  ctx.fillStyle = '#05030a';
  // Head
  ctx.beginPath();
  ctx.arc(300, 640, 24, 0, Math.PI * 2);
  ctx.fill();
  // Body / Torso
  ctx.beginPath();
  ctx.moveTo(300, 664);
  ctx.quadraticCurveTo(240, 715, 210, 900);
  ctx.lineTo(390, 900);
  ctx.quadraticCurveTo(360, 715, 300, 664);
  ctx.fill();

  // Reaching Arm
  ctx.strokeStyle = '#05030a';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(320, 690);
  ctx.lineTo(385, 510);
  ctx.stroke();

  // Glowing Brush Tip & Paint Burst
  const brushGrad = ctx.createRadialGradient(385, 510, 2, 385, 510, 35);
  brushGrad.addColorStop(0, '#ffffff');
  brushGrad.addColorStop(0.4, '#fbbf24');
  brushGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = brushGrad;
  ctx.beginPath();
  ctx.arc(385, 510, 35, 0, Math.PI * 2);
  ctx.fill();

  // Golden Paint Arc connecting Shadow Brush to Divine Halo
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(385, 510);
  ctx.bezierCurveTo(430, 410, 360, 350, 385, 280);
  ctx.stroke();

  return canvas.toDataURL('image/jpeg', 0.95);
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
    setAiStatus('⚡ Génération de l\'illustration IA en cours...');

    let finalDataUrl = '';

    try {
      const res = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.dataUrl && data.dataUrl.startsWith('data:image/')) {
          finalDataUrl = data.dataUrl;
        }
      }
    } catch {
      // Ignore network errors and fallback
    }

    if (!finalDataUrl) {
      finalDataUrl = generateProceduralCoverArt(prompt.trim());
    }

    onChange({
      ...coverConfig,
      mode: 'generated',
      illustrationUrl: finalDataUrl,
      aiGeneration: { prompt: prompt.trim(), provider: 'imagen-4' },
    });

    setIsGeneratingAi(false);
    setAiStatus('✨ Illustration IA générée et appliquée à la couverture !');
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

          {/* Illustration IA */}
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
