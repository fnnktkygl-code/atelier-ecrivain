/**
 * FloatingSelectionMenu — Menu flottant contextuel à la sélection (Style Notion / Medium)
 *
 * Permet le formatage immédiat (Gras, Italique, Souligné) et l'analyse IA ciblée du passage.
 */

'use client';

import React from 'react';
import { IconSparkles, IconSearch, IconPaperclip } from '@/components/Shared/Icons';

interface FloatingSelectionMenuProps {
  position: { top: number; left: number } | null;
  selectedText: string;
  onAnalyzeStyle: (text: string) => void;
  onFactCheck: (text: string) => void;
  onCreateNote: (text: string) => void;
  onClose: () => void;
  isAnalyzing?: boolean;
}

export default function FloatingSelectionMenu({
  position,
  selectedText,
  onAnalyzeStyle,
  onFactCheck,
  onCreateNote,
  onClose,
  isAnalyzing = false,
}: FloatingSelectionMenuProps) {
  if (!position || !selectedText.trim()) return null;

  const handleFormat = (command: 'bold' | 'italic' | 'underline') => {
    document.execCommand(command, false);
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const parent = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement;
      const blockEl = parent?.closest('.editor-block-content');
      if (blockEl) {
        blockEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  return (
    <div
      className="floating-selection-menu"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%) translateY(-10px)',
        zIndex: 100,
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
      onPointerDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
    >
      <div className="floating-menu-inner">
        {/* Style formatting buttons: Gras, Italique, Souligné */}
        <button
          type="button"
          className="floating-menu-btn format-btn"
          onClick={() => handleFormat('bold')}
          title="Mettre en gras (Cmd+B)"
          aria-label="Gras"
        >
          <strong style={{ fontWeight: 800 }}>B</strong>
        </button>

        <button
          type="button"
          className="floating-menu-btn format-btn"
          onClick={() => handleFormat('italic')}
          title="Mettre en italique (Cmd+I)"
          aria-label="Italique"
        >
          <em style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</em>
        </button>

        <button
          type="button"
          className="floating-menu-btn format-btn"
          onClick={() => handleFormat('underline')}
          title="Souligner (Cmd+U)"
          aria-label="Souligner"
        >
          <u style={{ textDecoration: 'underline' }}>U</u>
        </button>

        <div className="floating-menu-divider" />

        {/* AI Targeted Passage Analysis */}
        <button
          type="button"
          className="floating-menu-btn primary"
          onClick={() => {
            onAnalyzeStyle(selectedText);
            onClose();
          }}
          disabled={isAnalyzing}
          title="Analyser ce passage précis (Style & Ratures)"
        >
          <IconSparkles size={13} strokeWidth={2} />
          <span>Analyser ce passage</span>
        </button>

        <div className="floating-menu-divider" />

        <button
          type="button"
          className="floating-menu-btn"
          onClick={() => {
            onFactCheck(selectedText);
            onClose();
          }}
          disabled={isAnalyzing}
          title="Vérifier les affirmations historiques ou religieuses"
        >
          <IconSearch size={13} strokeWidth={2} />
          <span>Fact-check</span>
        </button>

        <div className="floating-menu-divider" />

        <button
          type="button"
          className="floating-menu-btn"
          onClick={() => {
            onCreateNote(selectedText);
            onClose();
          }}
          title="Créer une note de marge attachée à ce passage"
        >
          <IconPaperclip size={13} strokeWidth={2} />
          <span>Note</span>
        </button>
      </div>
      <div className="floating-menu-arrow" />
    </div>
  );
}
