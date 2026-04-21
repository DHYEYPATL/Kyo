'use client';

import { useState } from 'react';
import { Suggestion } from '@/types';
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '@/lib/defaults';
import { IconPin, IconCopy, IconCheck } from '@/components/Icon';
import styles from './SuggestionCard.module.css';

interface Props {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  onPin?: (id: string) => void;
  isNew?: boolean;
  index?: number;
}

export function SuggestionCard({ suggestion, onClick, onPin, isNew, index = 0 }: Props) {
  const color = SUGGESTION_TYPE_COLORS[suggestion.type] ?? 'var(--accent-champagne)';
  const label = SUGGESTION_TYPE_LABELS[suggestion.type] ?? suggestion.type;
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(suggestion.preview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin?.(suggestion.id);
  };

  return (
    <button
      id={`suggestion-${suggestion.id}`}
      className={`${styles.card} ${isNew ? styles.cardNew : ''} ${suggestion.isPinned ? styles.cardPinned : ''}`}
      style={{
        '--type-color': color,
        animationDelay: isNew ? `${index * 0.07}s` : '0s',
      } as React.CSSProperties}
      onClick={() => onClick(suggestion)}
      aria-label={`${label}: ${suggestion.preview}`}
    >
      <div className={styles.cardHeader}>
        <span
          className={styles.typeBadge}
          style={{ color, borderColor: `${color}50`, background: `${color}18` }}
        >
          {label}
        </span>

        {/* Action buttons — visible on hover */}
        <div className={styles.cardActions}>
          {onPin && (
            <button
              className={`${styles.actionIcon} ${suggestion.isPinned ? styles.actionIconActive : ''}`}
              onClick={handlePin}
              aria-label={suggestion.isPinned ? 'Unpin suggestion' : 'Pin suggestion'}
              title={suggestion.isPinned ? 'Unpin' : 'Pin to top'}
            >
              <IconPin size={11} />
            </button>
          )}
          <button
            className={`${styles.actionIcon} ${copied ? styles.actionIconCopied : ''}`}
            onClick={handleCopy}
            aria-label="Copy suggestion text"
            title="Copy to clipboard"
          >
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          </button>
        </div>
      </div>

      <p className={styles.preview}>{suggestion.preview}</p>
      <span className={styles.expandHint}>Expand for detail</span>
    </button>
  );
}
