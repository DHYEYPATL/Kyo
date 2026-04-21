'use client';

import { useEffect, useRef, useState } from 'react';
import { TranscriptSegment } from '@/types';
import { DEMO_SCENARIOS } from '@/lib/defaults';
import { formatTimestamp, formatDuration } from '@/lib/utils';
import { highlightEntities } from '@/lib/entityHighlight';
import {
  IconMic, IconMicOff, IconRefreshCw, IconSearch, IconEdit3,
  IconX, IconCheck, IconMonitor,
} from '@/components/Icon';
import styles from './TranscriptPanel.module.css';

interface Props {
  segments: TranscriptSegment[];
  isRecording: boolean;
  isTranscribing: boolean;
  pendingChunks: number;
  recordingDurationSec: number;
  audioLevel: number;
  isSpeaking: boolean;
  interimText: string;         // Live Web Speech API text — 0ms latency
  isWebSpeechActive: boolean;  // Whether Web Speech is streaming
  onStart: (mode: 'mic' | 'mixed') => void;
  onStop: () => void;
  onRefresh: () => void;
  onAddDemo: (text: string) => void;
  error: string | null;
}

export function TranscriptPanel({
  segments,
  isRecording,
  isTranscribing,
  pendingChunks,
  recordingDurationSec,
  audioLevel,
  isSpeaking,
  interimText,
  isWebSpeechActive,
  onStart,
  onStop,
  onRefresh,
  onAddDemo,
  error,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [demoText, setDemoText] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [injectingIdx, setInjectingIdx] = useState<number | null>(null);
  // #13 — transcript search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest segment
  useEffect(() => {
    if (!searchQuery) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, searchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  const handleDemoSubmit = () => {
    if (demoText.trim()) {
      onAddDemo(demoText.trim());
      setDemoText('');
    }
  };

  const handleLoadScenario = async (scenarioId: string) => {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    setActiveScenarioId(scenarioId);
    setInjectingIdx(0);

    for (let i = 0; i < scenario.chunks.length; i++) {
      setInjectingIdx(i);
      onAddDemo(scenario.chunks[i]);
      if (i < scenario.chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    setInjectingIdx(null);
  };

  // #13 — filter segments by search query
  const filteredSegments = searchQuery
    ? segments.filter((s) =>
        s.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments;

  const matchCount = searchQuery ? filteredSegments.length : 0;
  const isInjecting = injectingIdx !== null;

  // #11 — render segment text with entity highlights
  const renderSegmentText = (text: string) => {
    if (!text) return null;
    const highlighted = searchQuery
      ? highlightEntities(text).replace(
          new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
          '<mark class="search-match">$1</mark>'
        )
      : highlightEntities(text);

    return (
      <p
        className={styles.text}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  };

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <IconMic size={14} style={{ color: 'var(--accent-champagne)', flexShrink: 0 }} />
          <h2 className={styles.title}>Transcript</h2>
          {isRecording && (
            <span className={`${styles.livePill} ${isSpeaking ? styles.livePillSpeaking : ''}`}>
              <span className={styles.liveDot} />
              {formatDuration(recordingDurationSec)}
            </span>
          )}
        </div>

        {/* #7 — Audio level meter */}
        {isRecording && (
          <div className={styles.meterRow} aria-label="Microphone level">
            {Array.from({ length: 12 }).map((_, i) => {
              const threshold = (i + 1) / 12;
              const active = audioLevel >= threshold;
              return (
                <div
                  key={i}
                  className={`${styles.meterBar} ${active ? styles.meterBarActive : ''}`}
                  style={{
                    opacity: active ? 0.4 + audioLevel * 0.6 : 0.12,
                    height: `${40 + i * 4}%`,
                  }}
                />
              );
            })}
            <span className={styles.meterLabel}>
              {isSpeaking ? 'Listening' : 'Silence'}
            </span>
          </div>
        )}

        <div className={styles.controls}>
          {isRecording ? (
            <button
              id="mic-toggle-btn"
              className={`${styles.micBtn} ${styles.micBtnStop}`}
              onClick={onStop}
              aria-label="Stop recording (Space)"
              title="Stop [Space]"
            >
              <IconMicOff size={12} /> Stop
            </button>
          ) : (
            <div className={styles.startGroup}>
              <button
                id="mic-toggle-btn"
                className={`${styles.micBtn} ${styles.micBtnStart} ${styles.micBtnStartLeft}`}
                onClick={() => onStart('mic')}
                aria-label="Start recording mic (Space)"
                title="Record Mic [Space]"
              >
                <IconMic size={12} /> Mic
              </button>
              <button
                className={`${styles.micBtn} ${styles.micBtnStart} ${styles.micBtnStartRight}`}
                onClick={() => onStart('mixed')}
                aria-label="Start recording meeting (mic + tab)"
                title="Record Meeting (Mic + Tab)"
              >
                <IconMonitor size={12} /> Meet
              </button>
            </div>
          )}
          <div className={styles.controlsDivider} />
          <button
            id="transcript-refresh-btn"
            className={styles.iconBtn}
            onClick={onRefresh}
            title="Refresh suggestions [R]"
            aria-label="Refresh transcript and suggestions"
            disabled={segments.length === 0}
          >
            <IconRefreshCw size={13} />
          </button>
          {/* #13 — search toggle */}
          <button
            id="transcript-search-btn"
            className={`${styles.iconBtn} ${showSearch ? styles.iconBtnActive : ''}`}
            onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
            title="Search transcript"
            aria-label="Search transcript"
          >
            <IconSearch size={13} />
          </button>
          <button
            id="demo-mode-btn"
            className={`${styles.iconBtn} ${showDemo ? styles.iconBtnActive : ''}`}
            onClick={() => setShowDemo((v) => !v)}
            title="Demo mode"
            aria-label="Toggle demo mode"
          >
            <IconEdit3 size={13} />
          </button>
        </div>

        {/* #13 — Search bar */}
        {showSearch && (
          <div className={styles.searchRow}>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript…"
              aria-label="Search transcript"
            />
            {searchQuery && (
              <span className={styles.matchCount}>
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            )}
            {searchQuery && (
              <button
                className={styles.clearSearch}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Demo mode panel */}
        {showDemo && (
          <div className={styles.demoArea}>
            <div className={styles.scenarioRow}>
              <span className={styles.scenarioLabel}>Quick scenarios:</span>
              <div className={styles.scenarioBtns}>
                {DEMO_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    id={`demo-scenario-${scenario.id}`}
                    className={`${styles.scenarioBtn} ${activeScenarioId === scenario.id ? styles.scenarioBtnActive : ''}`}
                    onClick={() => handleLoadScenario(scenario.id)}
                    disabled={isInjecting}
                    title={scenario.label}
                    aria-label={`Load ${scenario.label} demo`}
                  >
                    {scenario.emoji} {scenario.label}
                    {activeScenarioId === scenario.id && isInjecting && (
                      <span className={styles.injectingDot} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className={styles.demoInput}
              value={demoText}
              onChange={(e) => setDemoText(e.target.value)}
              placeholder="Or type/paste your own transcript chunk here…"
              rows={3}
              aria-label="Custom demo transcript input"
            />
            <button
              id="demo-submit-btn"
              className={styles.demoSubmitBtn}
              onClick={handleDemoSubmit}
              disabled={!demoText.trim()}
            >
              ＋ Add Chunk
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.scrollArea}>
        {segments.length === 0 && !isRecording && !showDemo && (
          <div className={styles.emptyState}>
            <p>Click <strong>Record</strong> or press <kbd>Space</kbd> to begin.</p>
            <p className={styles.emptyHint}>Demo mode injects sample conversations instantly.</p>
            <p className={styles.emptyHint}>Press <kbd>?</kbd> for all keyboard shortcuts.</p>
          </div>
        )}

        {searchQuery && filteredSegments.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyHint}>No matches for "<strong>{searchQuery}</strong>"</p>
          </div>
        )}

        {filteredSegments.map((seg) => (
          <div key={seg.id} className={styles.segment}>
            <div className={styles.segMeta}>
              <span className={styles.chunkBadge}>#{seg.chunkIndex + 1}</span>
              <span className={styles.time}>{formatTimestamp(seg.timestamp)}</span>
            </div>
            {renderSegmentText(seg.text)}
          </div>
        ))}

        {/* ── Live interim transcript (Web Speech API, 0ms latency) ─── */}
        {isRecording && !searchQuery && (interimText || isWebSpeechActive) && (
          <div className={styles.interimSegment}>
            <div className={styles.segMeta}>
              <span className={styles.liveChunkBadge}>Live</span>
              <span className={styles.time}>now</span>
            </div>
            <p className={styles.interimText}>
              {interimText || <span className={styles.listeningHint}>Listening…</span>}
              <span className={styles.cursor} aria-hidden="true" />
            </p>
          </div>
        )}

        {/* Whisper polishing indicator — only show if no interim active */}
        {(isTranscribing || pendingChunks > 0) && !interimText && (
          <div className={styles.transcribingIndicator}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.transcribingLabel}>
              {pendingChunks > 1 ? `Polishing ${pendingChunks} chunks…` : 'Polishing transcript…'}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
