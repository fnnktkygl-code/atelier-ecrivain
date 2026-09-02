/**
 * FloatingSelectionMenu — Menu flottant contextuel à la sélection (Style Notion / Medium)
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
    >
      <div className="floating-menu-inner">
        <button
          className="floating-menu-btn primary"
          onClick={() => {
            onAnalyzeStyle(selectedText);
            onClose();
          }}
          disabled={isAnalyzing}
          title="Analyser et suggérer des ratures stylistiques sur ce passage"
        >
          <IconSparkles size={13} strokeWidth={2} />
          <span>Ratures & Style</span>
        </button>

        <div className="floating-menu-divider" />

        <button
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
