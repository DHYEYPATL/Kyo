'use client';

import { useState } from 'react';
import { SuggestionBatch, Suggestion } from '@/types';
import { SuggestionCard } from './SuggestionCard';
import { formatTimestamp, formatLatency } from '@/lib/utils';
import { MeetingPhase } from '@/lib/phaseDetection';
import { PHASE_LABELS } from '@/hooks/useSuggestions';
import { IconZap, IconRefreshCw, IconBookmark } from '@/components/Icon';
import styles from './SuggestionsPanel.module.css';

interface Props {
  batches: SuggestionBatch[];
  isLoading: boolean;
  error: string | null;
  currentPhase: MeetingPhase;
  onSuggestionClick: (s: Suggestion) => void;
  onPinSuggestion: (id: string) => void;
  onRefresh: () => void;
}

export function SuggestionsPanel({
  batches,
  isLoading,
  error,
  currentPhase,
  onSuggestionClick,
  onPinSuggestion,
  onRefresh,
}: Props) {
  const isEmpty = batches.length === 0;
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  // Pinned suggestions from across all batches
  const pinnedSuggestions = batches
    .flatMap((b) => b.suggestions)
    .filter((s) => s.isPinned);

  const toggleBatch = (id: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <IconZap size={14} style={{ color: 'var(--accent-champagne)', flexShrink: 0 }} />
          <h2 className={styles.title}>Suggestions</h2>
          {/* Phase badge (#1) */}
          <span className={styles.phaseBadge} title="Detected meeting phase">
            {PHASE_LABELS[currentPhase]}
          </span>
          {isLoading && <span className={styles.loadingPill}>Thinking…</span>}
        </div>

        <div className={styles.headerRight}>
          {batches.length > 0 && (
            <span className={styles.batchCount}>
              {batches.length} batch{batches.length !== 1 ? 'es' : ''}
            </span>
          )}
          <button
            id="suggestions-refresh-btn"
            className={styles.refreshBtn}
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh suggestions [R]"
            title="Refresh [R]"
          >
            <span className={isLoading ? styles.spinIcon : ''}>
              <IconRefreshCw size={12} />
            </span>
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {/* Loading skeletons */}
        {isEmpty && !isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
            <IconZap size={28} style={{ opacity: 0.35, color: 'var(--accent-champagne)' }} />
          </div>
            <p>Suggestions appear here as you speak.</p>
            <p className={styles.emptyHint}>
              They refresh every 30 s, or hit <kbd>R</kbd> to refresh manually.
            </p>
          </div>
        )}

        {isLoading && isEmpty && (
          <div className={styles.skeletonGroup}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        {isLoading && !isEmpty && (
          <div className={styles.loadingOverlay}>
            <div className={styles.skeletonGroup}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Pinned suggestions section */}
        {pinnedSuggestions.length > 0 && (
          <div className={styles.pinnedSection}>
            <div className={styles.pinnedHeader}>
              <span>📌 Pinned</span>
              <span className={styles.pinnedCount}>{pinnedSuggestions.length}</span>
            </div>
            <div className={styles.cardGrid}>
              {pinnedSuggestions.map((s, i) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onClick={onSuggestionClick}
                  onPin={onPinSuggestion}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* Batch history */}
        {batches.map((batch, batchIdx) => {
          const isLatest = batchIdx === 0;
          const isExpanded = isLatest || expandedBatchIds.has(batch.id);

          return (
            <div
              key={batch.id}
              className={`${styles.batch} ${isLatest ? styles.batchLatest : styles.batchOld}`}
            >
              <button
                className={styles.batchHeader}
                onClick={isLatest ? undefined : () => toggleBatch(batch.id)}
                aria-expanded={isExpanded}
                disabled={isLatest}
                title={isLatest ? 'Latest suggestions' : isExpanded ? 'Collapse' : 'Expand'}
              >
                <div className={styles.batchHeaderLeft}>
                  {isLatest ? (
                    <span className={styles.latestBadge}>
                      <span className={styles.latestDot} />
                      Latest
                    </span>
                  ) : (
                    <span className={styles.oldBadge}>#{batches.length - batchIdx}</span>
                  )}
                  <span className={styles.batchTime}>{formatTimestamp(batch.timestamp)}</span>
                  {batch.latencyMs && (
                    <span className={styles.batchLatency} title="Generation latency">
                      {formatLatency(batch.latencyMs)}
                    </span>
                  )}
                </div>
                {!isLatest && (
                  <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                )}
              </button>

              {isExpanded && (
                <div className={styles.cardGrid}>
                  {batch.suggestions.map((s, i) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onClick={onSuggestionClick}
                      onPin={onPinSuggestion}
                      isNew={isLatest}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
