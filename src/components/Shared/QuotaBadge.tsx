'use client';

import { useState, useEffect } from 'react';
import { getQuotaStatus } from '@/services/ai/quotaTracker';

export default function QuotaBadge() {
  const [status, setStatus] = useState(getQuotaStatus());
  const [hasCustomKey, setHasCustomKey] = useState(false);

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

  const titleText = hasCustomKey
    ? `Quota Gemini IA (Clé Dédiée) :\n• Statut : Clé Personnelle Active (Quota Illimité)\n• Utilisation aujourd'hui : ${status.dayCount} dictées`
    : `Quota Individuel (Session Google) :\n• Minute : ${status.minuteRemaining}/${status.minuteLimit} req. disponibles\n• Jour : ${status.dayRemaining}/${status.dayLimit} req. disponibles\n• Totalement indépendant des autres utilisateurs`;

  return (
    <div
      className="quota-badge-container"
      title={titleText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10.5,
        fontFamily: 'var(--font-sans)',
        color: hasCustomKey ? '#27ae60' : status.isWarning ? '#e53e3e' : 'var(--text-soft)',
        opacity: 0.85,
        padding: '2px 7px',
        borderRadius: 10,
        background: status.isWarning ? 'rgba(229,62,62,0.1)' : 'var(--surface-2)',
        border: '1px solid var(--border)',
        cursor: 'help',
        transition: 'all 0.2s ease',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: status.isWarning ? '#e53e3e' : '#27ae60',
          display: 'inline-block',
          boxShadow: status.isWarning ? '0 0 6px #e53e3e' : '0 0 4px #27ae60',
        }}
      />
      <span>
        {hasCustomKey ? 'Clé Dédiée' : `${status.minuteRemaining}/${status.minuteLimit} req.`}
      </span>
    </div>
  );
}
