'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CoverConfig, BookMetadata } from '../../types/bookMeta';

interface CoverControlsProps {
  coverConfig: CoverConfig;
  metadata: BookMetadata;
  onChange: (updated: CoverConfig) => void;
}

export interface CoverHistoryItem {
  id: string;
  illustrationUrl: string;
  prompt?: string;
  createdAt: number;
}

const COLOR_PALETTES = [
  '#8a5a34', '#1e293b', '#0f172a', '#312e81', '#701a75',
  '#831843', '#064e3b', '#78350f', '#451a03', '#111827',
  'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  'linear-gradient(135deg, #701a75 0%, #312e81 100%)',
  'linear-gradient(135deg, #831843 0%, #9a3412 100%)',
  'linear-gradient(135deg, #064e3b 0%, #0284c7 100%)',
];

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_COVER_DIMENSION = 1600;
const AI_GENERATION_TIMEOUT_MS = 25000;
const COVER_HISTORY_STORAGE_KEY = 'atelier_cover_history_v1';
const MAX_HISTORY_ITEMS = 12;

function resizeImageDataUrl(dataUrl: string, maxDim: number, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image illisible ou corrompue'));
    img.src = dataUrl;
  });
}

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
  ctx.beginPath();
  ctx.arc(300, 640, 24, 0, Math.PI * 2);
  ctx.fill();
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
  const [aiStatusIsError, setAiStatusIsError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Cover History State
  const [history, setHistory] = useState<CoverHistoryItem[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load History from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COVER_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {}
  }, []);

  // Helper to save item to History
  const addToHistory = (dataUrl: string, promptText?: string) => {
    setHistory((prev) => {
      // Filter out duplicate image DataURLs
      const filtered = prev.filter((item) => item.illustrationUrl !== dataUrl);
      const newItem: CoverHistoryItem = {
        id: `cover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        illustrationUrl: dataUrl,
        prompt: promptText,
        createdAt: Date.now(),
      };
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      try {
        localStorage.setItem(COVER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(COVER_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const selectFromHistory = (item: CoverHistoryItem) => {
    onChange({
      ...coverConfig,
      mode: 'generated',
      illustrationUrl: item.illustrationUrl,
      aiGeneration: item.prompt ? { prompt: item.prompt, provider: 'imagen-4' } : coverConfig.aiGeneration,
    });
    if (item.prompt) setPrompt(item.prompt);
    setAiStatus('✨ Cover sélectionnée depuis votre historique !');
  };

  const clearAllHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(COVER_HISTORY_STORAGE_KEY);
    } catch {}
  };

  const switchMode = (mode: CoverConfig['mode']) => {
    setAiStatus(null);
    setUploadError(null);
    onChange({ ...coverConfig, mode });
  };

  const handleRemoveIllustration = () => {
    setAiStatus(null);
    onChange({
      ...coverConfig,
      illustrationUrl: undefined,
      aiGeneration: null,
    });
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingAi(false);
    setAiStatusIsError(false);
    setAiStatus('🚫 Génération annulée.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Format non supporté : veuillez choisir une image (PNG, JPG, WEBP).');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Image trop volumineuse (max 15 Mo).');
      e.target.value = '';
      return;
    }

    try {
      const rawDataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target?.result as string);
        reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
        reader.readAsDataURL(file);
      });

      const resized = await resizeImageDataUrl(rawDataUrl, MAX_COVER_DIMENSION);
      addToHistory(resized, 'Image importée');
      onChange({ ...coverConfig, mode: 'imported', imageUrl: resized, illustrationUrl: undefined });
    } catch {
      setUploadError("Impossible de traiter cette image. Essayez un autre fichier.");
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateAiIllustration = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingAi(true);
    setAiStatusIsError(false);
    setAiStatus('⚡ Génération de l\'illustration IA en cours...');

    let finalDataUrl = '';
    let usedFallback = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), AI_GENERATION_TIMEOUT_MS);

    try {
      const res = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.dataUrl && data.dataUrl.startsWith('data:image/')) {
          finalDataUrl = data.dataUrl;
        }
      }
    } catch {
      // Aborted or network failure
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
    }

    if (controller.signal.aborted && !finalDataUrl) {
      return;
    }

    if (!finalDataUrl) {
      finalDataUrl = generateProceduralCoverArt(prompt.trim());
      usedFallback = true;
    }

    if (!finalDataUrl) {
      setIsGeneratingAi(false);
      setAiStatusIsError(true);
      setAiStatus("❌ La génération a échoué. Réessayez ou choisissez une image.");
      return;
    }

    // Add generated DataURL to persistent history
    addToHistory(finalDataUrl, prompt.trim());

    onChange({
      ...coverConfig,
      mode: 'generated',
      illustrationUrl: finalDataUrl,
      aiGeneration: { prompt: prompt.trim(), provider: usedFallback ? 'procedural-fallback' : 'imagen-4' },
    });

    setIsGeneratingAi(false);
    setAiStatusIsError(false);
    setAiStatus(
      usedFallback
        ? '🎨 Service IA indisponible : une illustration de secours a été générée et enregistrée dans votre historique.'
        : "✨ Illustration IA générée et enregistrée dans votre historique !"
    );
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
            onClick={() => switchMode('generated')}
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
            onClick={() => switchMode('imported')}
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
            onClick={() => switchMode('none')}
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
          {uploadError && (
            <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: '#dc2626' }}>{uploadError}</div>
          )}
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
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (aiStatus) setAiStatus(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isGeneratingAi && handleGenerateAiIllustration()}
                placeholder="Ex: Une ombre humaine qui tente de peindre un dieu à son image..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
              />

              {!isGeneratingAi ? (
                <button
                  type="button"
                  onClick={handleGenerateAiIllustration}
                  disabled={!prompt.trim()}
                  style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: prompt.trim() ? 'pointer' : 'not-allowed', opacity: prompt.trim() ? 1 : 0.6 }}
                >
                  Générer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  style={{ padding: '8px 14px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Annuler
                </button>
              )}
            </div>

            {aiStatus && (
              <div style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: isGeneratingAi ? 'var(--accent)' : aiStatusIsError ? '#dc2626' : '#16a34a' }}>
                {aiStatus}
              </div>
            )}

            {/* Aperçu miniature et bouton Supprimer l'illustration */}
            {coverConfig.illustrationUrl && (
              <div style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverConfig.illustrationUrl}
                    alt="Aperçu illustration"
                    style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      ✨ Illustration active
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {coverConfig.aiGeneration?.prompt ? `"${coverConfig.aiGeneration.prompt}"` : 'Illustration générée'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveIllustration}
                  title="Retirer cette illustration et revenir au fond uni/dégradé"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🗑️ Retirer
                </button>
              </div>
            )}
          </div>

          {/* 📜 HISTORIQUE DES COUVERTURES / ILLUSTRATIONS */}
          <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                📜 Historique des Couvertures ({history.length})
              </label>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllHistory}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Vider l'historique
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                Vos illustrations générées ou importées apparaîtront ici pour basculer facilement de l'une à l'autre.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 10 }}>
                {history.map((item) => {
                  const isSelected = coverConfig.illustrationUrl === item.illustrationUrl;
                  return (
                    <div
                      key={item.id}
                      onClick={() => selectFromHistory(item)}
                      title={item.prompt ? `"${item.prompt}" - Clic pour réappliquer` : 'Réappliquer cette couverture'}
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: 90,
                        borderRadius: 6,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid #16a34a' : '1px solid var(--border)',
                        boxShadow: isSelected ? '0 0 8px rgba(22, 163, 74, 0.5)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.illustrationUrl}
                        alt="Couverture"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          background: '#16a34a',
                          color: '#fff',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          fontSize: 10,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          ✓
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => removeFromHistory(item.id, e)}
                        title="Supprimer cette couverture de l'historique"
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(0, 0, 0, 0.75)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
