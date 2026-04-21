'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Audio source modes ───────────────────────────────────────────────────────
export type AudioMode = 'mic' | 'mixed';

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseAudioMixerReturn {
  /** Call this to build the final MediaStream to record from */
  buildStream: (mode: AudioMode) => Promise<{
    stream: MediaStream;           // mixed or mic-only stream for MediaRecorder / Whisper
    micStream: MediaStream;        // mic-only stream for Web Speech API + analyser
    displayStream: MediaStream | null;
  }>;
  stopAll: () => void;
  displayStreamActive: boolean;
}

/**
 * useAudioMixer
 *
 * Handles capturing mic + optional tab/system audio and mixing them via
 * the Web Audio API. This is the industry-standard approach used by
 * Fireflies, Otter.ai, Grain, and tl;dv for capturing both sides of
 * an online meeting.
 *
 * Flow (Meeting Mode):
 *   1. getUserMedia()     → mic stream  (user's own voice)
 *   2. getDisplayMedia()  → display stream (meeting tab audio — remote participants)
 *   3. Web Audio API mixes both → single MediaStream for MediaRecorder → Whisper
 *   4. Mic alone is still kept for Web Speech API (interim display)
 *
 * Browser support:
 *   Chrome  ✓  — tab audio works well; "Share tab audio" checkbox appears
 *   Edge    ✓  — same as Chrome (Chromium)
 *   Firefox ⚠  — getDisplayMedia audio limited; system audio only
 *   Safari  ✗  — no getDisplayMedia audio support
 */
export function useAudioMixer(): UseAudioMixerReturn {
  const [displayStreamActive, setDisplayStreamActive] = useState(false);

  // Keep refs for cleanup
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const micStreamRef    = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  // Keep strict references to Web Audio nodes so they don't get garbage collected (silent audio bug)
  const audioNodesRef   = useRef<unknown>(null);

  const stopAll = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    micStreamRef.current     = null;
    displayStreamRef.current = null;
    audioCtxRef.current      = null;
    audioNodesRef.current    = null;
    setDisplayStreamActive(false);
  }, []);

  const buildStream = useCallback(async (mode: AudioMode) => {
    // ── Step 1: Mic audio (always required) ──────────────────────────────────
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
      video: false,
    });
    micStreamRef.current = micStream;

    if (mode === 'mic') {
      return { stream: micStream, micStream, displayStream: null };
    }

    // ── Step 2: Display / tab audio (Meeting Mode) ────────────────────────────
    let displayStream: MediaStream | null = null;
    try {
      // getDisplayMedia MUST have video: true (or an object). Passing false causes a TypeError in Chrome!
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // true (allow Entrie Screen) instead of forcing 'browser' so Desktop Apps work!
        audio: {
          // Hint for better quality — not all browsers honour these
          suppressLocalAudioPlayback: false,
          noiseSuppression: false,
          echoCancellation: false,
          sampleRate: 16000,
        },
        // Hint Chromium to default to system audio included
        systemAudio: 'include',
      } as any);
    } catch (err) {
      console.warn('[AudioMixer] getDisplayMedia failed:', err);
      // Let the user know they cancelled or an error occurred at the dialog
      stopAll(); 
      throw new Error("Screen sharing was cancelled or is not supported. Please select 'Record Mic' if you do not want to record a meeting tab.");
    }

    // Immediately stop the video tracks since we only care about Audio (saves CPU)
    displayStream.getVideoTracks().forEach(t => {
      t.stop();
      if (displayStream) displayStream.removeTrack(t);
    });

    displayStreamRef.current = displayStream;

    // Check if we actually got an audio track from the display capture
    const displayAudioTracks = displayStream.getAudioTracks();
    if (displayAudioTracks.length === 0) {
      // User didn't check "Share tab audio"
      displayStream.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
      stopAll(); // prevent mic leak
      throw new Error("Meeting audio missing. Please make sure to select a Tab or Entire Screen, and check 'Also share tab/system audio' in the browser popup.");
    }

    // Listen for when the user stops sharing (clicks "Stop sharing" button)
    displayAudioTracks[0].addEventListener('ended', () => {
      setDisplayStreamActive(false);
    });

    setDisplayStreamActive(true);

    // ── Step 3: Mix mic + display via Web Audio API ───────────────────────────
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    const micSource     = audioCtx.createMediaStreamSource(micStream);
    const displaySource = audioCtx.createMediaStreamSource(displayStream);
    const destination   = audioCtx.createMediaStreamDestination();

    // Optional: slight gain boost on remote side to equalise volumes
    const displayGain = audioCtx.createGain();
    displayGain.gain.value = 1.2;

    micSource.connect(destination);
    displaySource.connect(displayGain);
    displayGain.connect(destination);

    // Force resume
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // Hang onto nodes to prevent aggressive V8 garbage collection
    audioNodesRef.current = { micSource, displaySource, displayGain, destination };

    return {
      stream: destination.stream,   // mixed → MediaRecorder → Whisper
      micStream,                    // mic only → Web Speech API + analyser
      displayStream,
    };
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  return { buildStream, stopAll, displayStreamActive };
}
