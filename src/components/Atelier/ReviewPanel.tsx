/**
 * ReviewPanel — Right-side drawer for AI review items
 *
 * Shows pending ratures and corrections with accept/reject/modify actions.
 */

'use client';

import { useState } from 'react';
import type { PendingReview, ManuscriptAction } from '@/types/editor';

interface ReviewPanelProps {
  reviews: PendingReview[];
  chapterIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReviewPanel({ reviews, chapterIndex, dispatch, isOpen, onClose }: ReviewPanelProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const acceptedCount = reviews.filter((r) => r.status === 'accepted').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;
  const totalCount = reviews.length;

  const filtered = reviews.filter((r) => filter === 'all' || r.status === filter);

  const handleAccept = (reviewId: string) => {
    dispatch({ type: 'ACCEPT_REVIEW', chapterIndex, reviewId });
  };

  const handleReject = (reviewId: string) => {
    dispatch({ type: 'REJECT_REVIEW', chapterIndex, reviewId });
  };

  return (
    <div className={`review-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="review-panel-header">
        <h3>
          Révisions & Historique
          {pendingCount > 0 ? (
            <span className="review-count">{pendingCount} en attente</span>
          ) : totalCount > 0 ? (
            <span className="review-count" style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}>
              {totalCount} archivée{totalCount > 1 ? 's' : ''}
            </span>
          ) : null}
        </h3>
        <button className="btn-icon" onClick={onClose} style={{ width: 32, height: 32, fontSize: 14 }}>
          ✕
        </button>
      </div>

      {/* AI Notice Disclaimer */}
      <div
        style={{
          padding: '8px 12px',
          margin: '8px 12px 0 12px',
          borderRadius: '6px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-soft)',
          lineHeight: '1.4',
        }}
      >
        💡 <strong>Historique & Traçabilité :</strong> Retrouvez ci-dessous toutes les suggestions Gemini acceptées ou rejetées.
      </div>

      {/* Filter tabs */}
      <div className="review-filters">
        <button
          className={`pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          📋 Toutes ({totalCount})
        </button>
        <button
          className={`pill ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          ⏳ En attente ({pendingCount})
        </button>
        <button
          className={`pill ${filter === 'accepted' ? 'active' : ''}`}
          onClick={() => setFilter('accepted')}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          ✅ Acceptées ({acceptedCount})
        </button>
        <button
          className={`pill ${filter === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilter('rejected')}
          style={{ fontSize: 11, padding: '4px 8px' }}
        >
          ❌ Rejetées ({rejectedCount})
        </button>
      </div>

      {/* Review items */}
      <div className="review-items">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="empty-state-icon" style={{ fontSize: 28 }}>
              {filter === 'pending' ? '✨' : '📋'}
            </div>
            <div className="empty-state-text" style={{ fontSize: 13 }}>
              {filter === 'pending'
                ? 'Aucune révision en attente. Dictez du texte pour recevoir des suggestions.'
                : 'Aucune révision dans cette catégorie.'}
            </div>
          </div>
        ) : (
          filtered.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              onAccept={() => handleAccept(review.id)}
              onReject={() => handleReject(review.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ReviewItem ──

function ReviewItem({
  review,
  onAccept,
  onReject,
}: {
  review: PendingReview;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPending = review.status === 'pending';

  return (
    <div className={`review-item ${review.status}`}>
      {/* Type badge */}
      <div className="review-item-header">
        <span className={`review-type-badge ${review.type}`}>
          {review.type === 'rature' ? '✂️ Rature' : '🔍 Correction'}
        </span>
        <span className={`review-status-badge ${review.status}`}>
          {review.status === 'pending' && '⏳'}
          {review.status === 'accepted' && '✅'}
          {review.status === 'rejected' && '❌'}
        </span>
      </div>

      {/* Original text */}
      {review.original && (
        <div className="review-original">
          <span className="label">Original : </span>
          <span className="text">{review.original}</span>
        </div>
      )}

      {/* Verification Notice */}
      <div style={{ fontSize: 10.5, color: 'var(--text-soft)', marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>ℹ️</span>
        <span>Généré par IA — À valider auprès des textes et sources d&apos;origine.</span>
      </div>

      {/* Suggestion */}
      <div className="review-suggestion">
        <span className="review-label">Suggestion :</span>
        <span className="review-text-new">{review.suggestion}</span>
      </div>

      {/* Explanation (expandable) */}
      {review.explanation && (
        <button
          className="review-explain-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▾' : '▸'} Explication
        </button>
      )}
      {expanded && review.explanation && (
        <div className="review-explanation">{review.explanation}</div>
      )}

      {/* Source */}
      {review.source && (
        <div className="review-source">📚 {review.source}</div>
      )}

      {/* Actions */}
      {isPending ? (
        <div className="review-actions" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onAccept} style={{ fontSize: 12, padding: '6px 12px' }} title="Remplace automatiquement le texte dans le manuscrit">
            ✓ Appliquer au texte
          </button>
          <button className="btn btn-ghost" onClick={onReject} style={{ fontSize: 12, padding: '6px 12px' }}>
            ✕ Rejeter
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: review.status === 'accepted' ? '#2e7d32' : '#c0392b', fontWeight: 600, marginTop: 8 }}>
          {review.status === 'accepted' ? '✅ Appliqué au manuscrit' : '❌ Rejeté'}
        </div>
      )}
    </div>
  );
}
