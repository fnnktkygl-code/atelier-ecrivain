'use client';

import React, { useState } from 'react';
import type { EditableChapter } from '@/types/editor';
import { BookMetadata, CoverConfig, FrontBackMatterSection } from '../types/bookMeta';
import { ExportSettings } from '../types/exportSettings';
import { ExportHistoryEntry } from '../types/job';
import {
  DEFAULT_EXPORT_SETTINGS,
  loadExportSettings,
  saveExportSettings,
  loadBookMetadata,
  saveBookMetadata,
  loadExportHistory,
  addExportHistoryEntry,
} from '../services/exportStorage';
import { generatePdf } from '../services/generatePdf';

import { StepMetadata } from './steps/StepMetadata';
import { StepFrontBackMatter } from './steps/StepFrontBackMatter';
import { StepCover } from './steps/StepCover';
import { StepTheme } from './steps/StepTheme';
import { StepLayout } from './steps/StepLayout';
import { StepReview } from './steps/StepReview';
import {
  IconBook,
  IconClose,
  IconEdit,
  IconPalette,
  IconFeather,
  IconSparkles,
} from '@/components/Shared/Icons';

interface ExportWizardProps {
  manuscriptId: string;
  manuscriptTitle: string;
  chapters: EditableChapter[];
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 1, title: 'Métadonnées', Icon: IconEdit },
  { id: 2, title: 'Liminaires & Textes', Icon: IconBook },
  { id: 3, title: 'Couverture', Icon: IconPalette },
  { id: 4, title: 'Thème Éditorial', Icon: IconFeather },
  { id: 5, title: 'Mise en Page', Icon: IconBook },
  { id: 6, title: 'Génération PDF', Icon: IconSparkles },
];

function ExportWizardContent({
  manuscriptId,
  manuscriptTitle,
  chapters,
  onClose,
}: {
  manuscriptId: string;
  manuscriptTitle: string;
  chapters: EditableChapter[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<number>(1);

  const initialData = loadBookMetadata(manuscriptId, manuscriptTitle);
  const [metadata, setMetadata] = useState<BookMetadata>(initialData.metadata);
  const [sections, setSections] = useState<FrontBackMatterSection[]>(initialData.sections);
  const [coverConfig, setCoverConfig] = useState<CoverConfig>(initialData.coverConfig);
  const [settings, setSettings] = useState<ExportSettings>(() => loadExportSettings(manuscriptId) || DEFAULT_EXPORT_SETTINGS);
  const [history, setHistory] = useState<ExportHistoryEntry[]>(() => loadExportHistory(manuscriptId));

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveAndPersist = (
    newMeta = metadata,
    newSec = sections,
    newCover = coverConfig,
    newSet = settings
  ) => {
    setMetadata(newMeta);
    setSections(newSec);
    setCoverConfig(newCover);
    setSettings(newSet);
    saveBookMetadata(manuscriptId, newMeta, newSec, newCover);
    saveExportSettings(manuscriptId, newSet);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      handleSaveAndPersist();
      const pdfBlob = await generatePdf(chapters, metadata, coverConfig, settings, sections);
      const url = URL.createObjectURL(pdfBlob);
      setGeneratedPdfUrl(url);

      const totalWords = chapters.reduce(
        (sum, ch) => sum + ch.blocks.reduce((s, b) => s + (b.content ? b.content.split(/\s+/).length : 0), 0),
        0
      );

      const newEntry: ExportHistoryEntry = {
        id: `exp-${Date.now()}`,
        createdAt: Date.now(),
        title: metadata.title || 'Manuscrit',
        themeId: settings.themeId,
        pageFormat: settings.page.format,
        wordCount: totalWords,
      };
      addExportHistoryEntry(manuscriptId, newEntry);
      setHistory(loadExportHistory(manuscriptId));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg || 'Erreur lors de la génération du PDF.');
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
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 1040,
          height: '88vh',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBook size={20} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                Studio « Exporter mon Livre en PDF »
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
                Rendu éditorial conforme · Typographie & Couverture sur mesure
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-soft)',
              padding: 4,
            }}
            aria-label="Fermer le studio"
          >
            <IconClose size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body: Sidebar Steps + Form */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Step Navigation Sidebar */}
          <div
            style={{
              width: 230,
              borderRight: '1px solid var(--border)',
              background: 'var(--surface-2)',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {STEPS.map((s) => {
              const { Icon } = s;
              const isActive = step === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {step === 1 && (
              <StepMetadata
                metadata={metadata}
                onChange={(m) => handleSaveAndPersist(m, sections, coverConfig, settings)}
              />
            )}

            {step === 2 && (
              <StepFrontBackMatter
                metadata={metadata}
                sections={sections}
                onUpdateMetadata={(m) => handleSaveAndPersist(m, sections, coverConfig, settings)}
                onUpdateSections={(sec) => handleSaveAndPersist(metadata, sec, coverConfig, settings)}
              />
            )}

            {step === 3 && (
              <StepCover
                coverConfig={coverConfig}
                metadata={metadata}
                onChange={(c) => handleSaveAndPersist(metadata, sections, c, settings)}
              />
            )}

            {step === 4 && (
              <StepTheme
                settings={settings}
                onChange={(s) => handleSaveAndPersist(metadata, sections, coverConfig, s)}
              />
            )}

            {step === 5 && (
              <StepLayout
                settings={settings}
                onChange={(s) => handleSaveAndPersist(metadata, sections, coverConfig, s)}
              />
            )}

            {step === 6 && (
              <StepReview
                metadata={metadata}
                sections={sections}
                coverConfig={coverConfig}
                settings={settings}
                isGenerating={isGenerating}
                generatedPdfUrl={generatedPdfUrl}
                errorMsg={errorMsg}
                history={history}
                onGenerate={handleGenerate}
              />
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            ‹ Précédent
          </button>

          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Étape {step} sur {STEPS.length}
          </span>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
            disabled={step === STEPS.length}
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            Suivant ›
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportWizard({
  manuscriptId,
  manuscriptTitle,
  chapters,
  isOpen,
  onClose,
}: ExportWizardProps) {
  if (!isOpen) return null;

  return (
    <ExportWizardContent
      key={`${manuscriptId}-${isOpen}`}
      manuscriptId={manuscriptId}
      manuscriptTitle={manuscriptTitle}
      chapters={chapters}
      onClose={onClose}
    />
  );
}
