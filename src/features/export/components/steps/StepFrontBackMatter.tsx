'use client';

import React, { useState } from 'react';
import { BookMetadata, FrontBackMatterSection } from '../../types/bookMeta';
import { IconBook, IconPlus, IconTrash } from '@/components/Shared/Icons';

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
            placeholder="À ma famille, pour leur soutien…"
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Épigraphe (Citation d&apos;ouverture)</label>
          <textarea
            value={metadata.epigraph || ''}
            onChange={(e) => onUpdateMetadata({ ...metadata, epigraph: e.target.value })}
            rows={2}
            placeholder="« Tout ce qui est écrit reste… » — Victor Hugo"
            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>4e de Couverture (Résumé d&apos;ouvrage)</label>
        <textarea
          value={metadata.backCoverBlurb || ''}
          onChange={(e) => onUpdateMetadata({ ...metadata, backCoverBlurb: e.target.value })}
          rows={3}
          placeholder="Résumé captivant qui apparaîtra au dos du livre…"
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
        />
      </div>

      {/* Sections Libres (Préface, Avant-propos, Postface...) */}
      <div style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <IconBook size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} />
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Sections de Texte Libre</h4>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as FrontBackMatterSection['kind'])}
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
            onChange={(e) => setNewPlacement(e.target.value as 'front' | 'back')}
            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          >
            <option value="front">Avant les chapitres (Liminaires)</option>
            <option value="back">Après les chapitres (Annexes)</option>
          </select>

          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la section (ex: Préface de l'auteur)…"
            style={{ flex: 1, minWidth: 160, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
          />

          <button
            type="button"
            onClick={addSection}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <IconPlus size={13} strokeWidth={2.2} />
            <span>Ajouter</span>
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
                  style={{ background: 'none', border: 'none', color: 'var(--japandi-terracotta)', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <IconTrash size={13} />
                  <span>Supprimer</span>
                </button>
              </div>
              <textarea
                value={sec.content}
                onChange={(e) => updateSectionContent(sec.id, e.target.value)}
                rows={2}
                placeholder={`Contenu de ${sec.title}…`}
                style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 12 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
