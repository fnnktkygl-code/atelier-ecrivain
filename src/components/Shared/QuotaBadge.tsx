'use client';

import { useState, useEffect } from 'react';
import { loadModelQuota } from '@/services/ai-router/quota/quotaStore';
import { getPacificDateString } from '@/services/ai-router/quota/resetSchedule';

export default function QuotaBadge() {
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dictationDayCount, setDictationDayCount] = useState(0);

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        setHasCustomKey(!!localStorage.getItem('atelier_user_gemini_key'));
      }
      const q36 = loadModelQuota('gemini-3.6-flash', 'generation');
      const q35 = loadModelQuota('gemini-3.5-flash', 'generation');
      const q25 = loadModelQuota('gemini-2.5-flash', 'generation');
      setDictationDayCount(q36.dayCount + q35.dayCount + q25.dayCount);
    };
    update();
    window.addEventListener('atelier_quota_updated', update);
    const interval = setInterval(update, 5000);
    return () => {
      window.removeEventListener('atelier_quota_updated', update);
      clearInterval(interval);
    };
  }, []);

  const totalLimit = 60; // 20 RPD x 3 models
  const remaining = Math.max(0, totalLimit - dictationDayCount);

  return (
    <div
      className="quota-badge-wrapper"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      <div
        className="quota-badge-container"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9.5,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          color: hasCustomKey ? '#27ae60' : remaining < 10 ? '#e53e3e' : 'var(--text-soft)',
          whiteSpace: 'nowrap',
          padding: '1px 6px',
          borderRadius: 6,
          background: remaining < 10 ? 'rgba(229,62,62,0.1)' : 'var(--surface-2, rgba(0,0,0,0.04))',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          lineHeight: '1.2',
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: remaining < 10 ? '#e53e3e' : '#27ae60',
            display: 'inline-block',
            flexShrink: 0,
            boxShadow: remaining < 10 ? '0 0 5px #e53e3e' : '0 0 4px #27ae60',
          }}
        />
        <span style={{ whiteSpace: 'nowrap' }}>
          {hasCustomKey ? 'Clé Dédiée' : `${remaining}/${totalLimit} req.`}
        </span>
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            zIndex: 9999,
            width: 250,
            padding: '10px 12px',
            background: 'var(--surface, #faf7f2)',
            border: '1px solid var(--border, rgba(0,0,0,0.12))',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            fontSize: 11,
            color: 'var(--text, #2c2523)',
            lineHeight: 1.5,
            pointerEvents: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent, #8a5a34)' }}>
            {hasCustomKey ? '🔑 Quota Gemini (Clé Dédiée)' : '🟢 Quota Multi-Modèles Gemini'}
          </div>
          {hasCustomKey ? (
            <div>• Clé personnelle active (Quota Illimité)<br />• Dictées aujourd&apos;hui : {dictationDayCount}</div>
          ) : (
            <div>
              • <strong>Dictée Vocale :</strong> {remaining}/{totalLimit} req. aujourd&apos;hui (3.6 / 3.5 / 2.5 Flash)<br />
              • <strong>Recherche Sourcée :</strong> 1500 req/jour<br />
              • <strong>Synthèse Vocale :</strong> 10 req/jour<br />
              <span style={{ fontSize: 10, color: 'var(--text-soft)', fontStyle: 'italic', marginTop: 4, display: 'block' }}>
                Réinitialisation à minuit heure Pacifique ({getPacificDateString()})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
