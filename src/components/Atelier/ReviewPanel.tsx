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
  const [filter, setFilter] = useState<'pending' | 'resolved'>('pending');

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const acceptedCount = reviews.filter((r) => r.status === 'accepted').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;
  const archivedCount = acceptedCount + rejectedCount;

  const filtered = reviews.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    return r.status !== 'pending';
  });

  const handleAccept = (reviewId: string) => {
    dispatch({ type: 'ACCEPT_REVIEW', chapterIndex, reviewId });
  };

  const handleReject = (reviewId: string) => {
    dispatch({ type: 'REJECT_REVIEW', chapterIndex, reviewId });
  };

  const handleApplyAll = () => {
    dispatch({ type: 'APPLY_ALL_REVIEWS', chapterIndex });
  };

  const handleRejectAll = () => {
    dispatch({ type: 'REJECT_ALL_REVIEWS', chapterIndex });
  };

  const handleClearArchived = () => {
    dispatch({ type: 'CLEAR_ARCHIVED_REVIEWS', chapterIndex });
  };

  if (!isOpen) return null;

  return (
    <div className={`review-panel ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="review-panel-header">
        <div className="review-panel-title">
          <IconScissors size={17} strokeWidth={2} />
          <h3>Révisions & Ratures</h3>
          {pendingCount > 0 ? (
            <span className="review-count">{pendingCount}/15 max</span>
          ) : (
            <span className="review-count archived">0 en attente</span>
          )}
        </div>
        <button className="btn-icon" onClick={onClose} title="Fermer" aria-label="Fermer le panneau">
          <IconClose size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Progress & Chapter Polish Status */}
      <div className="review-chapter-status">
        <div className="status-progress-bar">
          <div
            className={`status-progress-fill ${pendingCount === 0 ? 'complete' : ''}`}
            style={{ width: `${Math.min(100, (pendingCount / 15) * 100)}%` }}
          />
        </div>
        <div className="status-progress-label">
          {pendingCount === 0 ? (
            <span className="status-label-complete">
              <IconSparkles size={13} strokeWidth={2} />
              <span>Chapitre poli & fluide (0 suggestion active)</span>
            </span>
          ) : (
            <span className="status-label-pending">
              <span>Polissage en cours : <strong>{pendingCount}</strong> / 15 suggestion{pendingCount > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>

      {/* Fast Batch Actions (when multiple pending reviews) */}
      {pendingCount > 1 && filter === 'pending' && (
        <div className="review-batch-actions">
          <button className="btn-batch apply" onClick={handleApplyAll} title="Appliquer toutes les suggestions du chapitre">
            <IconCheck size={13} strokeWidth={2.2} />
            <span>Tout appliquer ({pendingCount})</span>
          </button>
          <button className="btn-batch reject" onClick={handleRejectAll} title="Conserver votre version brute d'origine">
            <IconClose size={13} strokeWidth={2.2} />
            <span>Tout rejeter</span>
          </button>
        </div>
      )}

      {/* Filter tabs (2 clean views) */}
      <div className="review-filters">
        <button
          className={`pill ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          En attente ({pendingCount}/15)
        </button>
        <button
          className={`pill ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          Historique résolu ({archivedCount})
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
              {filter === 'pending' ? (
                archivedCount > 0 ? (
                  <div className="review-all-resolved">
                    <p className="resolved-title">Toutes les suggestions sont résolues !</p>
                    <p className="resolved-desc">
                      Vos choix ({acceptedCount} appliquées, {rejectedCount} rejetées) sont archivés dans l’onglet <strong>Historique résolu</strong>.
                    </p>
                  </div>
                ) : (
                  'Aucune rature en attente sur ce chapitre. Votre texte est fluide et prêt.'
                )
              ) : (
                'Aucune révision archivée pour ce chapitre.'
              )}
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

      {/* Footer action to purge archives */}
      {archivedCount > 0 && filter === 'resolved' && (
        <div className="review-panel-footer">
          <button
            className="btn-clear-archive"
            onClick={handleClearArchived}
            title="Effacer l'historique archivé pour ce chapitre"
          >
            <IconClose size={13} strokeWidth={2} />
            <span>Purger l’historique ({archivedCount})</span>
          </button>
        </div>
      )}
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
