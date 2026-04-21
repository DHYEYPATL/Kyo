'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Web Speech API types (not in TS stdlib by default) ──────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

// ─── Feature detection ────────────────────────────────────────────────────────

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const isWebSpeechSupported = () => getSpeechRecognition() !== null;

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseInterimTranscriptReturn {
  /** Words appearing right now — replace these with Whisper result when it arrives */
  interimText: string;
  /** Committed Web Speech phrases (won't be replaced by Whisper) */
  finalText: string;
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  clearInterim: () => void;
}

/**
 * useInterimTranscript
 *
 * Wraps the browser's Web Speech API to stream real-time interim transcripts.
 *
 * Architecture:
 * - `interimText` updates word-by-word with 0ms latency as the user speaks.
 * - When Whisper returns its accurate result, call `clearInterim()` to wipe
 *   the interim text (the caller replaces it with the Whisper segment).
 * - `finalText` captures Web Speech final results as a fallback when Whisper
 *   hasn't returned yet (e.g. during a network delay).
 *
 * The result: users see words appear INSTANTLY while accurate Whisper text
 * arrives in the background every 8-15s — exactly how Google Meet works.
 */
export function useInterimTranscript(): UseInterimTranscriptReturn {
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isActiveRef = useRef(false);  // track intentional state vs auto-restarts

  const SpeechRecognitionCtor = getSpeechRecognition();
  const isSupported = SpeechRecognitionCtor !== null;

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor || isActiveRef.current) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalChunk += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (finalChunk) {
        setFinalText((prev) => (prev + finalChunk).trimStart());
        setInterimText('');
      }
      if (interim) {
        setInterimText(interim.trimStart());
      }
    };

    recognition.onerror = () => {
      // Silently absorb errors — don't surface them; Whisper is the source-of-truth
    };

    recognition.onend = () => {
      // Auto-restart if we're supposed to still be active
      if (isActiveRef.current) {
        try { recognition.start(); } catch { /* ignore race conditions */ }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    isActiveRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      isActiveRef.current = false;
    }
  }, [SpeechRecognitionCtor]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
    setFinalText('');
  }, []);

  const clearInterim = useCallback(() => {
    // Called when Whisper returns — wipes the interim display
    setInterimText('');
    setFinalText('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { interimText, finalText, isListening, isSupported, startListening, stopListening, clearInterim };
}
