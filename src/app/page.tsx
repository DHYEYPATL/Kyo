'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { LandingPage } from '@/components/LandingPage';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { SuggestionsPanel } from '@/components/SuggestionsPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { SettingsModal } from '@/components/SettingsModal';
import { LatencyBar } from '@/components/LatencyBar';
import {
  IconBrain, IconDownload, IconFilePdf, IconSettings, IconTrash2,
  IconKeyboard, IconWifi, IconWifiOff, IconX,
} from '@/components/Icon';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSuggestions } from '@/hooks/useSuggestions';
import { useChat } from '@/hooks/useChat';
import { useRollingSummary } from '@/hooks/useRollingSummary';
import { useSettings } from '@/context/SettingsContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSessionStore } from '@/store/sessionStore';
import { Suggestion, LatencyMetrics } from '@/types';
import { exportSession, downloadJson } from '@/lib/utils';
import { exportToPdf } from '@/lib/pdfExport';
import { saveSession, loadSession, clearSession } from '@/lib/persistence';
import styles from './page.module.css';

// ── Keyboard shortcut table ────────────────────────────────────────────────────
const SHORTCUTS = [
  { key: 'Space',    action: 'Start / stop recording' },
  { key: 'R',        action: 'Refresh suggestions' },
  { key: '1 / 2 / 3', action: 'Open suggestion 1 / 2 / 3' },
  { key: 'Cmd + E',  action: 'Export JSON' },
  { key: 'Cmd + P',  action: 'Export PDF' },
  { key: 'Cmd + ,',  action: 'Open settings' },
  { key: '?',        action: 'Toggle this help' },
  { key: 'Esc',      action: 'Close overlays' },
];

export default function Home() {
  const { settings, isLoaded } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewLanding, setViewLanding] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const sessionStartRef = useRef(Date.now());

  // ── Network / persistence / store ─────────────────────────────────────────
  const { isOnline, wasOffline } = useNetworkStatus();
  const { togglePinSuggestion } = useSessionStore();

  // ── Core hooks ─────────────────────────────────────────────────────────────
  const {
    isRecording, segments, recordingDurationSec,
    startRecording, stopRecording, addDemoSegment, clearTranscript,
    error: recorderError, isTranscribing, pendingChunks,
    audioLevel, isSpeaking,
    interimText, isWebSpeechActive,
  } = useAudioRecorder();

  const { summary, getRecentChunksText, updateSummary, isSummarizing, clearSummary } =
    useRollingSummary();

  const {
    batches, isLoading: suggestionsLoading, error: suggestionsError,
    currentPhase, latencyMetrics: suggestionLatency,
    refresh: refreshSuggestions, clearBatches,
  } = useSuggestions(segments, isRecording, summary, getRecentChunksText, recordingDurationSec);

  const {
    messages, isStreaming, error: chatError,
    latencyMetrics: chatLatency, sendMessage, expandSuggestion, clearChat,
  } = useChat();

  // ── Session persistence (#21) ──────────────────────────────────────────────
  const [resumePrompt, setResumePrompt] = useState<{ savedAt: number } | null>(null);
  const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSession().then((saved) => {
      if (saved && saved.segments.length > 0) setResumePrompt({ savedAt: saved.savedAt });
    });
  }, []);

  useEffect(() => {
    if (segments.length === 0 && messages.length === 0) return;
    if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
    persistenceTimerRef.current = setTimeout(() => {
      saveSession({ savedAt: Date.now(), segments, summary, batches, messages, sessionStartMs: sessionStartRef.current });
    }, 3000);
    return () => { if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current); };
  }, [segments, messages, summary, batches]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleManualRefresh = useCallback(async () => {
    await updateSummary(segments);
    const recentText = getRecentChunksText(segments);
    await refreshSuggestions(segments, summary, recentText, recordingDurationSec);
  }, [segments, summary, updateSummary, getRecentChunksText, refreshSuggestions, recordingDurationSec]);

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => expandSuggestion(suggestion, segments, summary),
    [expandSuggestion, segments, summary]
  );

  const handleSendMessage = useCallback(
    (text: string) => sendMessage(text, segments, summary),
    [sendMessage, segments, summary]
  );

  // ── Export JSON ────────────────────────────────────────────────────────────
  const handleExportJson = useCallback(() => {
    const combinedLatency: LatencyMetrics = {
      lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
      lastChatFirstTokenMs: chatLatency.lastChatFirstTokenMs,
      avgSuggestionLatencyMs: suggestionLatency.avgSuggestionLatencyMs,
    };
    const data = exportSession(segments, batches, messages, summary, combinedLatency, sessionStartRef.current);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJson(data, `twinmind-session-${ts}.json`);
  }, [segments, batches, messages, summary, suggestionLatency, chatLatency]);

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(() => {
    const combinedLatency: LatencyMetrics = {
      lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
      lastChatFirstTokenMs: chatLatency.lastChatFirstTokenMs,
      avgSuggestionLatencyMs: suggestionLatency.avgSuggestionLatencyMs,
    };
    exportToPdf({ segments, batches, messages, summary, latencyMetrics: combinedLatency, sessionStartMs: sessionStartRef.current });
  }, [segments, batches, messages, summary, suggestionLatency, chatLatency]);

  // ── Clear session ──────────────────────────────────────────────────────────
  const handleClearSession = useCallback(() => {
    clearTranscript(); clearBatches(); clearChat(); clearSummary();
    clearSession();
    sessionStartRef.current = Date.now();
    setResumePrompt(null);
  }, [clearTranscript, clearBatches, clearChat, clearSummary]);

  // ── Keyboard shortcuts (#15) ───────────────────────────────────────────────
  useKeyboardShortcuts(
    {
      onToggleMic:      () => isRecording ? stopRecording() : startRecording(),
      onManualRefresh:  handleManualRefresh,
      onClickSuggestion1: () => batches[0]?.suggestions[0] && handleSuggestionClick(batches[0].suggestions[0]),
      onClickSuggestion2: () => batches[0]?.suggestions[1] && handleSuggestionClick(batches[0].suggestions[1]),
      onClickSuggestion3: () => batches[0]?.suggestions[2] && handleSuggestionClick(batches[0].suggestions[2]),
      onExport:         handleExportJson,
      onOpenSettings:   () => setSettingsOpen(true),
    },
    !settingsOpen && !shortcutsOpen
  );

  // Cmd+P → PDF export
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        handleExportPdf();
      }
      if (e.key === '?') {
        const t = e.target as HTMLElement;
        if (!['INPUT', 'TEXTAREA'].includes(t.tagName)) setShortcutsOpen((v) => !v);
      }
      if (e.key === 'Escape') setShortcutsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleExportPdf]);

  const combinedMetrics: LatencyMetrics = {
    lastSuggestionLatencyMs: suggestionLatency.lastSuggestionLatencyMs,
    lastChatFirstTokenMs: chatLatency.lastChatFirstTokenMs,
    avgSuggestionLatencyMs: suggestionLatency.avgSuggestionLatencyMs,
  };

  if (!isLoaded) return <div style={{ height: '100vh', background: 'var(--bg-default)' }} />;
  if (!settings.groqApiKey || viewLanding) return <LandingPage onClose={() => setViewLanding(false)} />;

  return (
    <>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ── Keyboard shortcuts overlay ────────────────────────────────── */}
      {shortcutsOpen && (
        <div className="shortcutsOverlay" onClick={() => setShortcutsOpen(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="shortcutsPanel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3>Keyboard Shortcuts</h3>
              <button onClick={() => setShortcutsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
                <IconX size={14} />
              </button>
            </div>
            <table>
              <tbody>
                {SHORTCUTS.map(({ key, action }) => (
                  <tr key={key}>
                    <td><kbd>{key}</kbd></td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Resume session banner (#21) ───────────────────────────────── */}
      {resumePrompt && (
        <div className={styles.resumeBanner}>
          <span>Resume last session from {new Date(resumePrompt.savedAt).toLocaleTimeString()}?</span>
          <button className={styles.resumeDismiss} onClick={() => setResumePrompt(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Network toasts (#25) ──────────────────────────────────────── */}
      {!isOnline && <div className="toastBanner toastOffline">Connection lost — API calls paused</div>}
      {wasOffline && isOnline && <div className="toastBanner toastOnline">Connection restored</div>}

      {/* ── Main layout ───────────────────────────────────────────────── */}
      <div className={styles.layout}>
        <header className={styles.topBar}>
          {/* Brand */}
          <div 
            className={styles.brand} 
            onClick={() => setViewLanding(true)} 
            style={{ cursor: 'pointer' }}
            title="Return to Kyo Landing Page"
          >
            <span className={styles.brandIconWrap}>
              <IconBrain size={15} style={{ color: 'var(--accent-champagne)' }} />
            </span>
            <span className={styles.brandName}>Kyo</span>
            <span className={styles.brandTag}>[Session Active]</span>
          </div>

          {/* Top actions */}
          <div className={styles.topActions}>
            {/* Network pill */}
            <div className={`${styles.networkPill} ${isOnline ? styles.networkOnline : styles.networkOffline}`}>
              {isOnline
                ? <IconWifi size={11} />
                : <IconWifiOff size={11} />
              }
              {isOnline ? 'Online' : 'Offline'}
            </div>

            {/* Shortcuts hint */}
            <button className={styles.shortcutHint} onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts" aria-label="Show keyboard shortcuts">
              <IconKeyboard size={13} />
            </button>

            {/* Export JSON */}
            <button id="export-json-btn" className={styles.actionBtn} onClick={handleExportJson} title="Export session as JSON (Cmd+E)" aria-label="Export JSON">
              <IconDownload size={12} />
              <span>Export</span>
            </button>

            {/* Export PDF */}
            <button id="export-pdf-btn" className={`${styles.actionBtn} ${styles.pdfBtn}`} onClick={handleExportPdf} title="Export session as PDF (Cmd+P)" aria-label="Export PDF">
              <IconFilePdf size={12} />
              <span>PDF</span>
            </button>

            {/* Clear */}
            <button id="clear-session-btn" className={styles.actionBtn} onClick={handleClearSession} title="Clear session" aria-label="Clear session">
              <IconTrash2 size={12} />
              <span>Clear</span>
            </button>

            {/* Settings */}
            <button
              id="settings-btn"
              className={`${styles.actionBtn} ${styles.settingsBtn} ${!settings.groqApiKey ? styles.settingsBtnAlert : ''}`}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings (Cmd+,)"
              title="Settings (Cmd+,)"
            >
              <IconSettings size={12} />
              <span>Settings</span>
              {!settings.groqApiKey && <span className={styles.alertDot} />}
            </button>
          </div>
        </header>

        {/* 3-Column grid */}
        <main className={styles.columns}>
          <div className={styles.col}>
            <TranscriptPanel
              segments={segments}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              pendingChunks={pendingChunks}
              recordingDurationSec={recordingDurationSec}
              audioLevel={audioLevel}
              isSpeaking={isSpeaking}
              interimText={interimText}
              isWebSpeechActive={isWebSpeechActive}
              onStart={startRecording}
              onStop={stopRecording}
              onRefresh={handleManualRefresh}
              onAddDemo={addDemoSegment}
              error={recorderError}
            />
          </div>
          <div className={styles.col}>
            <SuggestionsPanel
              batches={batches}
              isLoading={suggestionsLoading}
              error={suggestionsError}
              currentPhase={currentPhase}
              onSuggestionClick={handleSuggestionClick}
              onPinSuggestion={togglePinSuggestion}
              onRefresh={handleManualRefresh}
            />
          </div>
          <div className={styles.col}>
            <ChatPanel
              messages={messages}
              isStreaming={isStreaming}
              error={chatError}
              onSendMessage={handleSendMessage}
            />
          </div>
        </main>

        <LatencyBar metrics={combinedMetrics} isSummarizing={isSummarizing} />
      </div>
    </>
  );
}
