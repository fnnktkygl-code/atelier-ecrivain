'use client';

import { useState, useEffect } from 'react';
import { getQuotaStatus } from '@/services/ai/quotaTracker';

export default function QuotaBadge() {
  const [status, setStatus] = useState(getQuotaStatus());
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const update = () => {
      setStatus(getQuotaStatus());
      if (typeof window !== 'undefined') {
        setHasCustomKey(!!localStorage.getItem('atelier_user_gemini_key'));
      }
    };
    update();
    window.addEventListener('atelier_quota_updated', update);
    const interval = setInterval(update, 5000);
    return () => {
      window.removeEventListener('atelier_quota_updated', update);
      clearInterval(interval);
    };
  }, []);

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
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          color: hasCustomKey ? '#27ae60' : status.isWarning ? '#e53e3e' : 'var(--text-soft)',
          whiteSpace: 'nowrap',
          padding: '2px 7px',
          borderRadius: 8,
          background: status.isWarning ? 'rgba(229,62,62,0.1)' : 'var(--surface-2, rgba(0,0,0,0.04))',
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
            background: status.isWarning ? '#e53e3e' : '#27ae60',
            display: 'inline-block',
            flexShrink: 0,
            boxShadow: status.isWarning ? '0 0 5px #e53e3e' : '0 0 4px #27ae60',
          }}
        />
        <span style={{ whiteSpace: 'nowrap' }}>
          {hasCustomKey ? 'Clé Dédiée' : `${status.minuteRemaining}/${status.minuteLimit} req.`}
        </span>
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            zIndex: 9999,
            width: 240,
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
            {hasCustomKey ? '🔑 Quota Gemini (Clé Dédiée)' : '🟢 Quota Individuel Google'}
          </div>
          {hasCustomKey ? (
            <div>• Clé personnelle active (Quota Illimité)<br />• Dictées aujourd&apos;hui : {status.dayCount}</div>
          ) : (
            <div>
              • <strong>Minute :</strong> {status.minuteRemaining}/${status.minuteLimit} req. disponibles<br />
              • <strong>Jour :</strong> {status.dayRemaining}/${status.dayLimit} req. disponibles<br />
              <span style={{ fontSize: 10, color: 'var(--text-soft)', fontStyle: 'italic', marginTop: 4, display: 'block' }}>
                Totalement indépendant des autres utilisateurs
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
