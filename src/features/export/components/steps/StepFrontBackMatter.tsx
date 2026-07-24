'use client';

import React, { useState } from 'react';
import { BookMetadata, FrontBackMatterSection } from '../../types/bookMeta';

interface StepFrontBackMatterProps {
  metadata: BookMetadata;
  sections: FrontBackMatterSection[];
  onUpdateMetadata: (updated: BookMetadata) => void;
  onUpdateSections: (updated: FrontBackMatterSection[]) => void;
}

export function StepFrontBackMatter({
  metadata,
  sections,
  onUpdateMetadata,
  onUpdateSections,
}: StepFrontBackMatterProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<FrontBackMatterSection['kind']>('preface');
  const [newPlacement, setNewPlacement] = useState<'front' | 'back'>('front');

  const addSection = () => {
    if (!newTitle.trim()) return;
    const newSec: FrontBackMatterSection = {
      id: `${Date.now()}`,
      placement: newPlacement,
      kind: newKind,
      title: newTitle.trim(),
      content: '',
      order: sections.length + 1,
    };
    onUpdateSections([...sections, newSec]);
    setNewTitle('');
  };

  const removeSection = (id: string) => {
    onUpdateSections(sections.filter((s) => s.id !== id));
  };

  const updateSectionContent = (id: string, content: string) => {
    onUpdateSections(sections.map((s) => (s.id === id ? { ...s, content } : s)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
        2. Liminaires, Préfaces & Postfaces
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Dédicace</label>
          <textarea
            value={metadata.dedication || ''}
            onChange={(e) => onUpdateMetadata({ ...metadata, dedication: e.target.value })}
            rows={2}
            placeholder="À ma famille, pour leur soutien..."
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Épigraphe (Citation d'ouverture)</label>
          <textarea
            value={metadata.epigraph || ''}
            onChange={(e) => onUpdateMetadata({ ...metadata, epigraph: e.target.value })}
            rows={2}
            placeholder="« Tout ce qui est écrit reste... » — Victor Hugo"
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>4e de Couverture (Résumé d'ouvrage / Quatrième de couverture)</label>
        <textarea
          value={metadata.backCoverBlurb || ''}
          onChange={(e) => onUpdateMetadata({ ...metadata, backCoverBlurb: e.target.value })}
          rows={3}
          placeholder="Résumé captivant qui apparaîtra au dos du livre..."
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
        />
      </div>

      {/* Sections Libres (Préface, Avant-propos, Postface...) */}
      <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700 }}>📄 Sections de Texte Libre</h4>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <select
            value={newKind}
            onChange={(e: any) => setNewKind(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          >
            <option value="preface">Préface</option>
            <option value="foreword">Avant-propos</option>
            <option value="afterword">Postface</option>
            <option value="appendix">Annexe</option>
            <option value="glossary">Glossaire</option>
            <option value="custom">Section personnalisée</option>
          </select>

          <select
            value={newPlacement}
            onChange={(e: any) => setNewPlacement(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          >
            <option value="front">Avant les chapitres (Liminaires)</option>
            <option value="back">Après les chapitres (Annexes)</option>
          </select>

          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la section (ex: Préface de l'auteur)..."
            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          />

          <button
            type="button"
            onClick={addSection}
            style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
          >
            ＋ Ajouter
          </button>
        </div>

        {/* Dynamic Sections List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map((sec) => (
            <div key={sec.id} style={{ background: 'var(--surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>
                  [{sec.placement === 'front' ? 'Avant-propos' : 'Postface'}] {sec.title}
                </span>
                <button
                  type="button"
                  onClick={() => removeSection(sec.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                >
                  🗑️ Supprimer
                </button>
              </div>
              <textarea
                value={sec.content}
                onChange={(e) => updateSectionContent(sec.id, e.target.value)}
                rows={2}
                placeholder={`Contenu de ${sec.title}...`}
                style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
