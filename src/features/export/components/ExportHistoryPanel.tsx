'use client';

import React from 'react';
import { ExportHistoryEntry } from '../types/job';

interface ExportHistoryPanelProps {
  history: ExportHistoryEntry[];
  onSelectEntry?: (entry: ExportHistoryEntry) => void;
}

export function ExportHistoryPanel({ history, onSelectEntry }: ExportHistoryPanelProps) {
  if (!history || history.length === 0) {
    return (
      <div style={{ fontSize: 12, opacity: 0.7, fontStyle: 'italic', padding: 8 }}>
        Aucun export précédent enregistré.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>📜 Historique des Derniers Exports :</div>
      {history.map((h) => {
        const dateStr = new Date(h.createdAt).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return (
          <div
            key={h.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12
            }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>{h.title}</span>
              <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 11 }}>({h.pageFormat} • {h.themeId})</span>
              <div style={{ fontSize: 10, opacity: 0.5 }}>{dateStr} • {h.wordCount} mots</div>
            </div>
            {onSelectEntry && (
              <button
                type="button"
                onClick={() => onSelectEntry(h)}
                style={{ padding: '3px 8px', borderRadius: 4, background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
              >
                Recharger
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
