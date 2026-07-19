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
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

  const filtered = reviews.filter((r) => filter === 'all' || r.status === filter);
  const pendingCount = reviews.filter((r) => r.status === 'pending').length;

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
          Révisions
          {pendingCount > 0 && (
            <span className="review-count">{pendingCount}</span>
          )}
        </h3>
        <button className="btn-icon" onClick={onClose} style={{ width: 32, height: 32, fontSize: 14 }}>
          ✕
        </button>
      </div>

      {/* Filter tabs */}
      <div className="review-filters">
        {(['pending', 'accepted', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            className={`pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: 11, padding: '4px 8px' }}
          >
            {f === 'pending' && '⏳ En attente'}
            {f === 'accepted' && '✅ Acceptées'}
            {f === 'rejected' && '❌ Rejetées'}
            {f === 'all' && '📋 Toutes'}
          </button>
        ))}
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
          <span className="review-label">Original :</span>
          <span className="review-text-strike">{review.original}</span>
        </div>
      )}

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
      {isPending && (
        <div className="review-actions">
          <button className="btn btn-primary" onClick={onAccept} style={{ fontSize: 12, padding: '6px 14px' }}>
            ✓ Accepter
          </button>
          <button className="btn btn-ghost" onClick={onReject} style={{ fontSize: 12, padding: '6px 14px' }}>
            ✕ Rejeter
          </button>
        </div>
      )}
    </div>
  );
}
