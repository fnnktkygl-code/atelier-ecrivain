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
  // Default to 'pending' to keep editor clean and uncluttered
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected' | 'all'>('pending');

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const acceptedCount = reviews.filter((r) => r.status === 'accepted').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;
  const archivedCount = acceptedCount + rejectedCount;
  const totalCount = reviews.length;

  const filtered = reviews.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const handleAccept = (reviewId: string) => {
    dispatch({ type: 'ACCEPT_REVIEW', chapterIndex, reviewId });
  };

  const handleReject = (reviewId: string) => {
    dispatch({ type: 'REJECT_REVIEW', chapterIndex, reviewId });
  };

  const handleClearArchived = () => {
    dispatch({ type: 'CLEAR_ARCHIVED_REVIEWS', chapterIndex });
    setFilter('pending');
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
            <span className="review-count">{pendingCount} à traiter</span>
          ) : archivedCount > 0 ? (
            <span className="review-count archived">
              {archivedCount} résolue{archivedCount > 1 ? 's' : ''}
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
          {pendingCount > 0
            ? 'Suggestions stylistiques et factuelles pour affiner votre texte.'
            : 'Toutes les suggestions de ce passage ont été traitées.'}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="review-filters">
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
        <button
          className={`pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Toutes ({totalCount})
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
                    <p className="resolved-title">Toutes les suggestions sont traitées !</p>
                    <p className="resolved-desc">
                      Vos décisions sont conservées dans les onglets <strong>Acceptées ({acceptedCount})</strong> et <strong>Rejetées ({rejectedCount})</strong>.
                    </p>
                  </div>
                ) : (
                  'Aucune révision en attente. Dictez au micro ou analysez votre texte pour recevoir des suggestions.'
                )
              ) : filter === 'accepted' ? (
                'Aucune proposition acceptée pour le moment.'
              ) : filter === 'rejected' ? (
                'Aucune proposition rejetée.'
              ) : (
                'Aucune révision enregistrée dans ce chapitre.'
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
      {archivedCount > 0 && (
        <div className="review-panel-footer">
          <button
            className="btn-clear-archive"
            onClick={handleClearArchived}
            title="Effacer les révisions acceptées et rejetées pour libérer l’historique"
          >
            <IconClose size={13} strokeWidth={2} />
            <span>Purger les {archivedCount} révision{archivedCount > 1 ? 's' : ''} archivée{archivedCount > 1 ? 's' : ''}</span>
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
