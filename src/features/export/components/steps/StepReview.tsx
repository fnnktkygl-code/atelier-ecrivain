'use client';

import React from 'react';
import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../../types/bookMeta';
import { ExportSettings } from '../../types/exportSettings';
import { ExportHistoryEntry } from '../../types/job';
import { ExportHistoryPanel } from '../ExportHistoryPanel';

interface StepReviewProps {
  metadata: BookMetadata;
  sections: FrontBackMatterSection[];
  coverConfig: CoverConfig;
  settings: ExportSettings;
  isGenerating: boolean;
  generatedPdfUrl: string | null;
  errorMsg: string | null;
  history: ExportHistoryEntry[];
  onGenerate: () => void;
}

export function StepReview({
  metadata,
  sections,
  coverConfig,
  settings,
  isGenerating,
  generatedPdfUrl,
  errorMsg,
  history,
  onGenerate,
}: StepReviewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        6. Récapitulatif & Génération du PDF Éditorial
      </h3>

      {/* Summary Box */}
      <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📖 Informations :</div>
          <div>• Titre : <strong>{metadata.title || 'Sans titre'}</strong></div>
          <div>• Auteur : <strong>{metadata.authorName || 'Non spécifié'}</strong></div>
          <div>• Éditeur : {metadata.publisher || 'Auto-édition'}</div>
          <div>• ISBN : {metadata.isbn || 'Aucun'}</div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🎨 Design & Layout :</div>
          <div>• Format : <strong>{settings.page.format}</strong> ({settings.page.orientation})</div>
          <div>• Thème : <strong>{settings.themeId.toUpperCase()}</strong></div>
          <div>• Couverture : <strong>{coverConfig.mode === 'none' ? 'Sans' : coverConfig.mode === 'imported' ? 'Image Importée' : 'Graphique'}</strong></div>
          <div>• Sections libres : <strong>{sections.length}</strong> section(s)</div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #ef4444', color: '#991b1b', borderRadius: 8, fontSize: 12 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Action Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
        {!generatedPdfUrl ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent) 0%, #b8860b 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: isGenerating ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating ? '⏳ Génération du PDF Éditorial en cours...' : '⚡ Générer le Livre PDF'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 15 }}>
              ✨ PDF Éditorial généré avec succès !
            </div>
            <a
              href={generatedPdfUrl}
              download={`${metadata.title || 'manuscrit'}.pdf`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                borderRadius: 10, background: '#16a34a', color: '#ffffff', textDecoration: 'none',
                fontSize: 14, fontWeight: 700, boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
              }}
            >
              📥 Télécharger le PDF de mon Livre
            </a>
          </div>
        )}
      </div>

      {/* Export History */}
      <ExportHistoryPanel history={history} />
    </div>
  );
}
