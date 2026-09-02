/**
 * ReviewPanel — Tiroir des révisions et suggestions IA (Japandi Minimaliste)
 */

'use client';

import { useState } from 'react';
import type { PendingReview, ManuscriptAction } from '@/types/editor';
import {
  IconScissors,
  IconSearch,
  IconCheck,
  IconClose,
  IconSparkles,
  IconLightbulb,
  IconInfo,
  IconBook,
} from '@/components/Shared/Icons';

interface ReviewPanelProps {
  reviews: PendingReview[];
  chapterIndex: number;
  dispatch: React.Dispatch<ManuscriptAction>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReviewPanel({
  reviews,
  chapterIndex,
  dispatch,
  isOpen,
  onClose,
}: ReviewPanelProps) {
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

  if (!isOpen) return null;

  return (
    <div className={`review-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="review-panel-header">
        <div className="review-panel-title">
          <IconScissors size={17} strokeWidth={2} />
          <h3>Révisions & Suggestions</h3>
          {pendingCount > 0 ? (
            <span className="review-count">{pendingCount} en attente</span>
          ) : totalCount > 0 ? (
            <span className="review-count archived">
              {totalCount} archivée{totalCount > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
        <button className="btn-icon" onClick={onClose} title="Fermer" aria-label="Fermer le panneau">
          <IconClose size={16} strokeWidth={2} />
        </button>
      </div>

      {/* AI Notice Disclaimer */}
      <div className="review-disclaimer">
        <IconLightbulb size={15} strokeWidth={2} />
        <span>
          <strong>Historique :</strong> Retrouvez toutes les suggestions de style et corrections factuelles.
        </span>
      </div>

      {/* Filter tabs */}
      <div className="review-filters">
        <button
          className={`pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Toutes ({totalCount})
        </button>
        <button
          className={`pill ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          En attente ({pendingCount})
        </button>
        <button
          className={`pill ${filter === 'accepted' ? 'active' : ''}`}
          onClick={() => setFilter('accepted')}
        >
          Acceptées ({acceptedCount})
        </button>
        <button
          className={`pill ${filter === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilter('rejected')}
        >
          Rejetées ({rejectedCount})
        </button>
      </div>

      {/* Review items */}
      <div className="review-items">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconSparkles size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-text">
              {filter === 'pending'
                ? 'Aucune révision en attente. Dictez ou analysez votre texte pour recevoir des suggestions.'
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
          {review.type === 'rature' ? (
            <>
              <IconScissors size={12} strokeWidth={2} />
              <span>Rature de style</span>
            </>
          ) : (
            <>
              <IconSearch size={12} strokeWidth={2} />
              <span>Correction factuelle</span>
            </>
          )}
        </span>
        <span className={`review-status-badge ${review.status}`}>
          {review.status === 'pending' && <span className="status-dot pending" />}
          {review.status === 'accepted' && (
            <span className="status-badge-accepted">
              <IconCheck size={11} strokeWidth={2.5} />
              <span>Acceptée</span>
            </span>
          )}
          {review.status === 'rejected' && (
            <span className="status-badge-rejected">
              <IconClose size={11} strokeWidth={2.5} />
              <span>Rejetée</span>
            </span>
          )}
        </span>
      </div>

      {/* Content comparison */}
      <div className="review-content">
        <div className="review-original">
          <span className="review-label">Texte original :</span>
          <span className="review-text-strike">{review.original}</span>
        </div>
        <div className="review-suggestion">
          <span className="review-label">Suggestion Gemini :</span>
          <span className="review-text-new">{review.suggestion}</span>
        </div>
      </div>

      {/* Explanation */}
      {review.explanation && (
        <div className="review-explanation">
          <IconInfo size={13} strokeWidth={2} />
          <span>{review.explanation}</span>
        </div>
      )}

      {/* Source citation */}
      {review.source && (
        <div className="review-source">
          <IconBook size={12} strokeWidth={2} />
          <span>{review.source}</span>
        </div>
      )}

      {/* Actions (for pending items) */}
      {isPending && (
        <div className="review-actions">
          <button className="btn btn-sm btn-ghost danger" onClick={onReject}>
            <IconClose size={13} strokeWidth={2.2} />
            <span>Rejeter</span>
          </button>
          <button className="btn btn-sm btn-primary" onClick={onAccept}>
            <IconCheck size={13} strokeWidth={2.2} />
            <span>Appliquer</span>
          </button>
        </div>
      )}

      {/* Toggle details for resolved items */}
      {!isPending && (
        <button className="review-expand-btn" onClick={() => setExpanded(!expanded)}>
          <span>{expanded ? 'Masquer les détails' : 'Afficher les détails'}</span>
        </button>
      )}
    </div>
  );
}
