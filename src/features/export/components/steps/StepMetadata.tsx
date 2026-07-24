'use client';

import React from 'react';
import { BookMetadata } from '../../types/bookMeta';

interface StepMetadataProps {
  metadata: BookMetadata;
  onChange: (updated: BookMetadata) => void;
}

export function StepMetadata({ metadata, onChange }: StepMetadataProps) {
  const updateField = (key: keyof BookMetadata, value: any) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>1. Métadonnées du Livre</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Titre du livre *</label>
          <input
            type="text"
            value={metadata.title}
            onChange={(e) => updateField('title', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Sous-titre (optionnel)</label>
          <input
            type="text"
            value={metadata.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nom de l'auteur *</label>
          <input
            type="text"
            value={metadata.authorName}
            onChange={(e) => updateField('authorName', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
            required
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nom de plume (pseudonyme)</label>
          <input
            type="text"
            value={metadata.penName || ''}
            onChange={(e) => updateField('penName', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Code ISBN</label>
          <input
            type="text"
            value={metadata.isbn || ''}
            onChange={(e) => updateField('isbn', e.target.value)}
            placeholder="978-2-123456-78-9"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Éditeur</label>
          <input
            type="text"
            value={metadata.publisher || ''}
            onChange={(e) => updateField('publisher', e.target.value)}
            placeholder="Auto-édition..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Année Copyright</label>
          <input
            type="number"
            value={metadata.copyrightYear || new Date().getFullYear()}
            onChange={(e) => updateField('copyrightYear', parseInt(e.target.value) || new Date().getFullYear())}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Mentions légales / Achevé d'imprimer</label>
        <textarea
          value={metadata.legalNotice || ''}
          onChange={(e) => updateField('legalNotice', e.target.value)}
          rows={2}
          placeholder="Tous droits réservés. Dépôt légal..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'sans-serif' }}
        />
      </div>
    </div>
  );
}
