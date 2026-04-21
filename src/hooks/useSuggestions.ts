'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SuggestionBatch, Suggestion, TranscriptSegment, LatencyMetrics } from '@/types';
import { fetchSuggestions } from '@/lib/groq';
import { generateId } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import {
  detectMeetingPhase,
  PHASE_SUGGESTION_STRATEGY,
  PHASE_LABELS,
  MeetingPhase,
} from '@/lib/phaseDetection';

interface UseSuggestionsReturn {
  batches: SuggestionBatch[];
  isLoading: boolean;
  error: string | null;
  currentPhase: MeetingPhase;
  latencyMetrics: Pick<LatencyMetrics, 'lastSuggestionLatencyMs' | 'avgSuggestionLatencyMs'>;
  refresh: (segments: TranscriptSegment[], summary: string, recentChunksText: string, elapsedSec?: number) => Promise<void>;
  clearBatches: () => void;
}

export function useSuggestions(
  segments: TranscriptSegment[],
  isRecording: boolean,
  summary: string,
  getRecentChunksText: (segs: TranscriptSegment[]) => string,
  recordingDurationSec: number = 0
): UseSuggestionsReturn {
  const { settings } = useSettings();
  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [allLatencies, setAllLatencies] = useState<number[]>([]);
  const [currentPhase, setCurrentPhase] = useState<MeetingPhase>('opening');

  // ── Stable refs so the auto-refresh interval never needs to re-register ────
  // (avoids the dep-array loop: refresh → batches → new refresh → new interval…)
  const segmentsRef        = useRef(segments);
  const summaryRef         = useRef(summary);
  const settingsRef        = useRef(settings);
  const recordingDurRef    = useRef(recordingDurationSec);
  const isLoadingRef       = useRef(false);
  const batchesRef         = useRef(batches);
  const getRecentRef       = useRef(getRecentChunksText);

  // Keep refs in sync every render — no extra renders triggered
  useEffect(() => { segmentsRef.current     = segments; },           [segments]);
  useEffect(() => { summaryRef.current      = summary; },            [summary]);
  useEffect(() => { settingsRef.current     = settings; },           [settings]);
  useEffect(() => { recordingDurRef.current = recordingDurationSec; }, [recordingDurationSec]);
  useEffect(() => { batchesRef.current      = batches; },            [batches]);
  useEffect(() => { getRecentRef.current    = getRecentChunksText; }, [getRecentChunksText]);

  // ── Core refresh function ──────────────────────────────────────────────────
  const refresh = useCallback(
    async (
      currentSegments: TranscriptSegment[],
      currentSummary: string,
      recentText: string,
      elapsedSec: number = recordingDurRef.current
    ) => {
      const cfg = settingsRef.current;

      if (!cfg.groqApiKey) {
        setError('Groq API key not set — open ⚙ Settings.');
        return;
      }
      if (!recentText.trim()) {
        // Silently skip — no transcript yet, not an error worth showing
        return;
      }
      // Don't stack concurrent requests
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      // #1 — Meeting phase detection
      const phase = detectMeetingPhase(recentText, currentSummary, elapsedSec);
      setCurrentPhase(phase);
      const phaseInstruction = PHASE_SUGGESTION_STRATEGY[phase];

      // #3 — Avoided-suggestion memory (last 2 batches)
      const avoidPreviews = batchesRef.current
        .slice(0, 2)
        .flatMap((b) => b.suggestions.map((s) => s.preview));

      try {
        const { suggestions: rawSuggestions, latencyMs } = await fetchSuggestions(
          recentText,
          currentSummary,
          cfg.suggestionPrompt,
          cfg.groqApiKey,
          cfg.llmModel,
          avoidPreviews,
          phaseInstruction
        );

        const suggestions: Suggestion[] = rawSuggestions.slice(0, 3).map((s) => ({
          ...s,
          id: generateId(),
          timestamp: Date.now(),
          isPinned: false,
        }));

        const batch: SuggestionBatch = {
          id: generateId(),
          timestamp: Date.now(),
          suggestions,
          transcriptContext: recentText,
          latencyMs,
        };

        setBatches((prev) => [batch, ...prev]);
        setLastLatencyMs(latencyMs);
        setAllLatencies((prev) => [...prev, latencyMs]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [] // intentionally empty — all deps accessed via refs
  );

  // ── Auto-refresh every N seconds while recording ───────────────────────────
  //
  // Key design decisions:
  //  1. The interval ref never changes. Only one interval runs at a time.
  //  2. We don't put `refresh` or `segments` in deps — we read them via refs.
  //     This is the standard pattern to avoid the "interval restarts on every
  //     render" bug that caused auto-refresh to silently fail.
  //  3. The interval is cleared and restarted only when isRecording or the
  //     autoRefreshInterval setting changes.

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isRecording) return;

    const intervalMs = (settingsRef.current.autoRefreshInterval ?? 30) * 1000;

    intervalRef.current = setInterval(() => {
      const segs    = segmentsRef.current;
      const summ    = summaryRef.current;
      const elapsed = recordingDurRef.current;
      const recent  = getRecentRef.current(segs);

      // Only fire if there is actually something to work with
      if (recent.trim()) {
        refresh(segs, summ, recent, elapsed);
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Only restart the interval if recording state or the interval duration changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, settings.autoRefreshInterval]);

  const clearBatches = useCallback(() => {
    setBatches([]);
    setError(null);
    setLastLatencyMs(null);
    setAllLatencies([]);
    setCurrentPhase('opening');
    batchesRef.current = [];
    isLoadingRef.current = false;
  }, []);

  const avgLatency = allLatencies.length
    ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
    : null;

  return {
    batches,
    isLoading,
    error,
    currentPhase,
    latencyMetrics: {
      lastSuggestionLatencyMs: lastLatencyMs,
      avgSuggestionLatencyMs: avgLatency,
    },
    refresh,
    clearBatches,
  };
}

export { PHASE_LABELS };
