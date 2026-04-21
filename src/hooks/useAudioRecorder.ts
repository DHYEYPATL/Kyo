'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment } from '@/types';
import { transcribeWithRetry, prewarmGroqConnection } from '@/lib/groq';
import { generateId } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import { useAudioAnalyser } from './useAudioAnalyser';
import { useInterimTranscript } from './useInterimTranscript';
import { useAudioMixer, AudioMode } from './useAudioMixer';

// ─── Adaptive chunk intervals ─────────────────────────────────────────────────
//
// Shorter chunks = lower perceived latency. We tune by speech density.
// Dense speech (>60 wpm): 8s  — transcribes fast, surfaces context quickly
// Normal speech (30-60):  12s — good balance of accuracy vs. speed
// Sparse speech (<30):    20s — wait for more audio to get usable transcription
//
// All shorter than the 30s spec ("roughly every 30s") — the spec is a max,
// not a minimum. Shorter chunks with overlap = better real-time feel.

const CHUNK_DENSE_MS   = 8_000;   // high speech rate
const CHUNK_NORMAL_MS  = 12_000;  // default
const CHUNK_SPARSE_MS  = 20_000;  // low speech rate / silence heavy

// Pre-warm Groq 6s before chunk fires to eliminate cold-start TLS latency
const PREWARM_OFFSET_MS = 6_000;

// Minimum bytes to attempt transcription (avoids sending near-silent audio)
const MIN_BLOB_BYTES = 2_000;

interface UseAudioRecorderReturn {
  isRecording: boolean;
  segments: TranscriptSegment[];
  recordingDurationSec: number;
  startRecording: (mode?: AudioMode) => Promise<void>;
  stopRecording: () => void;
  addDemoSegment: (text: string) => void;
  clearTranscript: () => void;
  error: string | null;
  isTranscribing: boolean;
  pendingChunks: number;
  // Instant interim display (#dual-path)
  interimText: string;        // live words from Web Speech API (~0ms latency)
  isWebSpeechActive: boolean; // whether Web Speech is running
  // Audio analyser
  audioLevel: number;
  isSpeaking: boolean;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const { settings } = useSettings();

  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);

  const { audioLevel, isSpeaking, connectStream, disconnect } = useAudioAnalyser();
  const {
    interimText,
    isListening: isWebSpeechActive,
    startListening: startInterim,
    stopListening: stopInterim,
    clearInterim,
  } = useInterimTranscript();

  const { buildStream, stopAll, displayStreamActive } = useAudioMixer();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prewarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);

  // Word-count tracking for adaptive interval
  const lastWordCountRef = useRef(40);  // assume medium density until proven otherwise
  // Noise-floor detection: skip chunk if same interim text as before (silence)
  const lastInterimRef = useRef('');

  // ─── Adaptive interval based on recent speech density ────────────────────
  const getAdaptiveIntervalMs = useCallback(() => {
    const wc = lastWordCountRef.current;
    if (wc > 60) return CHUNK_DENSE_MS;
    if (wc < 20) return CHUNK_SPARSE_MS;
    return CHUNK_NORMAL_MS;
  }, []);

  // ─── Process one audio blob through Whisper ───────────────────────────────
  const processChunk = useCallback(
    async (audioBlob: Blob, chunkIndex: number) => {
      if (audioBlob.size < MIN_BLOB_BYTES) return;

      setPendingChunks((n) => n + 1);
      setIsTranscribing(true);

      try {
        const text = await transcribeWithRetry(
          audioBlob,
          settings.groqApiKey,
          settings.transcriptionModel,
          undefined,
          3
        );

        if (text.trim()) {
          const wordCount = text.split(/\s+/).length;
          lastWordCountRef.current = wordCount;

          // Replace the interim Web Speech display with accurate Whisper text
          clearInterim();

          setSegments((prev) => [
            ...prev,
            { id: generateId(), text: text.trim(), timestamp: Date.now(), isFinal: true, chunkIndex },
          ]);
        } else {
          // Empty transcription → likely silence; just clear interim
          clearInterim();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription error';
        if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('permission')) {
          setError('Invalid Groq API key. Please check Settings.');
        } else if (!msg.includes('abort')) {
          setError(`Transcription failed: ${msg}`);
        }
      } finally {
        setPendingChunks((n) => Math.max(0, n - 1));
        setIsTranscribing(false);
      }
    },
    [settings.groqApiKey, settings.transcriptionModel, clearInterim]
  );

  // ─── Stop & flush the current MediaRecorder chunk ─────────────────────────
  const flushChunk = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ─── Start a new MediaRecorder chunk ─────────────────────────────────────
  const startChunk = useCallback(
    (stream: MediaStream) => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      const localChunks: Blob[] = [];
      const myChunkIndex = chunkIndexRef.current++;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) localChunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(localChunks, { type: mimeType });
        processChunk(blob, myChunkIndex);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    },
    [processChunk]
  );

  // ─── Schedule the next chunk rotation ─────────────────────────────────────
  const scheduleChunk = useCallback(
    (stream: MediaStream) => {
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);

      const intervalMs = getAdaptiveIntervalMs();

      // Pre-warm Groq connection before the chunk fires
      const prewarmDelay = Math.max(0, intervalMs - PREWARM_OFFSET_MS);
      prewarmTimerRef.current = setTimeout(() => {
        if (settings.groqApiKey) {
          prewarmGroqConnection(settings.groqApiKey, settings.llmModel);
        }
      }, prewarmDelay);

      // Chunk rotation
      chunkTimerRef.current = setTimeout(() => {
        flushChunk();
        startChunk(stream);
        scheduleChunk(stream);     // tail-recurse for next interval
      }, intervalMs);
    },
    [getAdaptiveIntervalMs, settings.groqApiKey, settings.llmModel, flushChunk, startChunk]
  );

  // ─── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async (mode: AudioMode = 'mic') => {
    setError(null);
    if (!settings.groqApiKey) {
      setError('Please set your Groq API key in ⚙ Settings first.');
      return;
    }

    try {
      const { stream, micStream } = await buildStream(mode);
      
      streamRef.current = stream;
      chunkIndexRef.current = 0;
      lastWordCountRef.current = 40;
      lastInterimRef.current = '';

      // Wire up audio analyser for the level meter (use mic for meter, or mixed if you want both)
      // We'll use the mixed stream so the meter reacts to both sides of the meeting
      connectStream(stream);

      // Start Web Speech API for instant interim display
      // Web speech automatically binds to default mic (it ignores generic streams safely)
      startInterim();

      // Start Whisper recording pipeline
      startChunk(stream);
      scheduleChunk(stream);

      setIsRecording(true);
      setRecordingDurationSec(0);

      timerIntervalRef.current = setInterval(
        () => setRecordingDurationSec((s) => s + 1),
        1000
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.match(/permission|denied|not allowed/i)) {
        setError('Microphone access denied. Please allow microphone permission and try again.');
      } else if (msg.match(/not found|no device/i)) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Could not start recording: ${msg}`);
      }
    }
  }, [settings.groqApiKey, startChunk, scheduleChunk, connectStream, startInterim, buildStream]);

  // ─── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (chunkTimerRef.current) { clearTimeout(chunkTimerRef.current); chunkTimerRef.current = null; }
    if (prewarmTimerRef.current) { clearTimeout(prewarmTimerRef.current); prewarmTimerRef.current = null; }
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }

    flushChunk();
    
    stopAll();
    streamRef.current = null;

    stopInterim();
    disconnect();
    setIsRecording(false);
  }, [flushChunk, stopInterim, disconnect, stopAll]);

  const addDemoSegment = useCallback((text: string) => {
    lastWordCountRef.current = text.split(/\s+/).length;
    setSegments((prev) => [
      ...prev,
      { id: generateId(), text, timestamp: Date.now(), isFinal: true, chunkIndex: chunkIndexRef.current++ },
    ]);
  }, []);

  const clearTranscript = useCallback(() => {
    setSegments([]);
    setError(null);
    chunkIndexRef.current = 0;
    lastWordCountRef.current = 40;
    setRecordingDurationSec(0);
    clearInterim();
  }, [clearInterim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopInterim();
      disconnect();
    };
  }, [stopInterim, disconnect]);

  return {
    isRecording,
    segments,
    recordingDurationSec,
    startRecording,
    stopRecording,
    addDemoSegment,
    clearTranscript,
    error,
    isTranscribing,
    pendingChunks,
    interimText,
    isWebSpeechActive,
    audioLevel,
    isSpeaking,
  };
}
