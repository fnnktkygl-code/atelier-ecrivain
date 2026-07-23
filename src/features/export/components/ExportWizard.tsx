'use client';

import React, { useState } from 'react';
import type { EditableChapter } from '@/types/editor';
import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../types/bookMeta';
import { ExportSettings, ThemeId } from '../types/exportSettings';
import { DEFAULT_EXPORT_SETTINGS, loadExportSettings, saveExportSettings } from '../services/exportStorage';
import { generatePdf } from '../services/generatePdf';
import { CoverCanvas } from './CoverEditor/CoverCanvas';
import { THEME_REGISTRY } from '../themes/registry';

interface ExportWizardProps {
  manuscriptId: string;
  manuscriptTitle: string;
  chapters: EditableChapter[];
  isOpen: boolean;
  onClose: () => void;
}

export function ExportWizard({
  manuscriptId,
  manuscriptTitle,
  chapters,
  isOpen,
  onClose,
}: ExportWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [metadata, setMetadata] = useState<BookMetadata>({
    title: manuscriptTitle || 'Mon Livre',
    authorName: 'Auteur',
    copyrightYear: new Date().getFullYear(),
  });

  const [coverConfig, setCoverConfig] = useState<CoverConfig>({
    mode: 'none',
    background: { type: 'color', value: '#8a5a34' },
    titleColor: '#ffffff',
  });

  const [settings, setSettings] = useState<ExportSettings>(() =>
    loadExportSettings(manuscriptId)
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      saveExportSettings(manuscriptId, settings);
      const pdfBlob = await generatePdf(chapters, metadata, coverConfig, settings);
      const url = URL.createObjectURL(pdfBlob);
      setGeneratedPdfUrl(url);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la génération du PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 960,
          height: '85vh',
          background: 'var(--surface, #faf7f2)',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              📖 Exporter mon livre en PDF Éditorial
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
              Étape {step} sur 4 — {step === 1 ? 'Métadonnées' : step === 2 ? 'Couverture' : step === 3 ? 'Thème Graphique' : 'Génération & Rendu'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-soft)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Main Form Area */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {step === 1 && (
              <div>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>1. Métadonnées du Livre</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Titre de l&apos;ouvrage *
                    <input
                      type="text"
                      value={metadata.title}
                      onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Sous-titre (optionnel)
                    <input
                      type="text"
                      value={metadata.subtitle || ''}
                      onChange={(e) => setMetadata({ ...metadata, subtitle: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Nom d&apos;auteur ou Pseudonyme *
                    <input
                      type="text"
                      value={metadata.authorName}
                      onChange={(e) => setMetadata({ ...metadata, authorName: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>
                    Dédicace (optionnel)
                    <textarea
                      value={metadata.dedication || ''}
                      onChange={(e) => setMetadata({ ...metadata, dedication: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>2. Couverture</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Mode de Couverture :</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className={`pill ${coverConfig.mode === 'none' ? 'active' : ''}`}
                      onClick={() => setCoverConfig({ ...coverConfig, mode: 'none' })}
                    >
                      Sans Couverture
                    </button>
                    <button
                      className={`pill ${coverConfig.mode === 'generated' ? 'active' : ''}`}
                      onClick={() => setCoverConfig({ ...coverConfig, mode: 'generated' })}
                    >
                      Création Manuelle
                    </button>
                  </div>

                  {coverConfig.mode === 'generated' && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12 }}>Couleur de Fond :</label>
                      <input
                        type="color"
                        value={coverConfig.background?.value || '#8a5a34'}
                        onChange={(e) =>
                          setCoverConfig({
                            ...coverConfig,
                            background: { type: 'color', value: e.target.value },
                          })
                        }
                        style={{ width: 60, height: 36, border: 'none', cursor: 'pointer' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>3. Thème Graphique</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {Object.values(THEME_REGISTRY).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSettings({ ...settings, themeId: t.id })}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: `2px solid ${settings.themeId === t.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: settings.themeId === t.id ? 'rgba(138,90,52,0.08)' : 'var(--surface-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: t.colors.accent }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>
                        Police: {t.fonts.body} • Style: {t.chapterOpening}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h3 style={{ marginTop: 0, fontSize: 16 }}>4. Génération du PDF</h3>
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  {!generatedPdfUrl ? (
                    <div>
                      <p style={{ fontSize: 14, color: 'var(--text-soft)', marginBottom: 20 }}>
                        Prêt à générer votre manuscrit ({chapters.length} chapitres) au format PDF éditorial.
                      </p>
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="btn btn-primary"
                        style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700 }}
                      >
                        {isGenerating ? '⏳ Génération en cours...' : '⚡ Générer le PDF'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                      <h4 style={{ margin: 0, fontSize: 18, color: '#27ae60' }}>PDF généré avec succès !</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '8px 0 20px 0' }}>
                        Votre manuscrit est prêt pour le téléchargement.
                      </p>
                      <a
                        href={generatedPdfUrl}
                        download={`${metadata.title || 'manuscrit'}.pdf`}
                        className="btn btn-primary"
                        style={{ padding: '12px 28px', fontSize: 15, textDecoration: 'none', display: 'inline-block' }}
                      >
                        📥 Télécharger le PDF
                      </a>
                    </div>
                  )}

                  {errorMsg && (
                    <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 16 }}>
                      ⚠️ {errorMsg}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Preview Side Panel */}
          <div
            style={{
              width: 280,
              borderLeft: '1px solid var(--border)',
              background: 'var(--surface-2)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CoverCanvas coverConfig={coverConfig} metadata={metadata} />
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-soft)', textAlign: 'center' }}>
              Aperçu en direct de la couverture
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2)',
          }}
        >
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="btn btn-ghost"
            style={{ opacity: step === 1 ? 0.5 : 1 }}
          >
            ← Précédent
          </button>
          <button
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            disabled={step === 4}
            className="btn btn-primary"
            style={{ opacity: step === 4 ? 0.5 : 1 }}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}
