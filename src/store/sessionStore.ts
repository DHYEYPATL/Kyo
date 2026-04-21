'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TranscriptSegment, SuggestionBatch, ChatMessage, Suggestion } from '@/types';
import { generateId } from '@/lib/utils';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface SessionState {
  // Transcript
  segments: TranscriptSegment[];
  addSegment: (text: string, chunkIndex: number) => void;
  clearSegments: () => void;

  // Rolling summary
  summary: string;
  setSummary: (s: string) => void;
  clearSummary: () => void;

  // Suggestion batches
  batches: SuggestionBatch[];
  addBatch: (batch: SuggestionBatch) => void;
  togglePinSuggestion: (suggestionId: string) => void;
  clearBatches: () => void;

  // Chat messages
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  // Session meta
  sessionStartMs: number;
  resetSession: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  devtools(
    (set) => ({
      // ── Transcript ────────────────────────────────────────────────────────
      segments: [],
      addSegment: (text, chunkIndex) =>
        set((s) => ({
          segments: [
            ...s.segments,
            { id: generateId(), text, timestamp: Date.now(), isFinal: true, chunkIndex },
          ],
        })),
      clearSegments: () => set({ segments: [] }),

      // ── Summary ────────────────────────────────────────────────────────────
      summary: '',
      setSummary: (summary) => set({ summary }),
      clearSummary: () => set({ summary: '' }),

      // ── Batches ────────────────────────────────────────────────────────────
      batches: [],
      addBatch: (batch) => set((s) => ({ batches: [batch, ...s.batches] })),
      togglePinSuggestion: (suggestionId) =>
        set((s) => ({
          batches: s.batches.map((b) => ({
            ...b,
            suggestions: b.suggestions.map((sg) =>
              sg.id === suggestionId ? { ...sg, isPinned: !sg.isPinned } : sg
            ),
          })),
        })),
      clearBatches: () => set({ batches: [] }),

      // ── Messages ───────────────────────────────────────────────────────────
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateMessage: (id, updates) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      clearMessages: () => set({ messages: [] }),

      // ── Session ────────────────────────────────────────────────────────────
      sessionStartMs: Date.now(),
      resetSession: () =>
        set({
          segments: [],
          summary: '',
          batches: [],
          messages: [],
          sessionStartMs: Date.now(),
        }),
    }),
    { name: 'TwinMindSession' }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectPinnedSuggestions = (state: SessionState): Suggestion[] =>
  state.batches.flatMap((b) => b.suggestions.filter((s) => s.isPinned));
