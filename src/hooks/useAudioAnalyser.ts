'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const SILENCE_THRESHOLD = 12;       // 0–255 scale; below this = silence
const SILENCE_GRACE_FRAMES = 90;    // ~3s at 30fps before declaring silence

interface AudioAnalyserReturn {
  audioLevel: number;          // 0–1 normalized level for the meter
  isSpeaking: boolean;         // true when voice activity detected
  connectStream: (stream: MediaStream) => void;
  disconnect: () => void;
}

/**
 * useAudioAnalyser (#7)
 *
 * Attaches a Web Audio AnalyserNode to the mic stream.
 * - Exposes a normalized audioLevel (0–1) for the visual meter.
 * - Provides isSpeaking for voice-activity detection (VAD).
 * - VAD uses a silence grace period to avoid flicker on brief pauses.
 */
export function useAudioAnalyser(): AudioAnalyserReturn {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceFramesRef = useRef(0);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buffer);

    const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalized = Math.min(avg / 80, 1); // 80 = comfortable speaking level

    setAudioLevel(normalized);

    if (avg > SILENCE_THRESHOLD) {
      silenceFramesRef.current = 0;
      setIsSpeaking(true);
    } else {
      silenceFramesRef.current += 1;
      if (silenceFramesRef.current > SILENCE_GRACE_FRAMES) {
        setIsSpeaking(false);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const connectStream = useCallback(
    (stream: MediaStream) => {
      // Tear down any existing context first
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Do NOT connect to ctx.destination — avoids mic feedback loop

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      rafRef.current = requestAnimationFrame(tick);
    },
    [tick]
  );

  const disconnect = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setAudioLevel(0);
    setIsSpeaking(false);
    silenceFramesRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => disconnect(), [disconnect]);

  return { audioLevel, isSpeaking, connectStream, disconnect };
}
