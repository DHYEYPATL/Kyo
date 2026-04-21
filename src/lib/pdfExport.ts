// ─── PDF Export (Print-to-PDF via styled popup window) ───────────────────────
//
// Generates a beautifully styled HTML document, opens it in a new window,
// and triggers the browser's native print-to-PDF dialog.
// No heavy dependencies — produces crisp, enterprise-grade output.

import { TranscriptSegment, SuggestionBatch, ChatMessage, LatencyMetrics } from '@/types';

// Raw session data shape passed directly from page.tsx
export interface PdfSessionData {
  segments: TranscriptSegment[];
  batches: SuggestionBatch[];
  messages: ChatMessage[];
  summary: string;
  latencyMetrics: LatencyMetrics;
  sessionStartMs: number;
}

const TYPE_COLORS: Record<string, string> = {
  'question':      '#7d9e7f',
  'fact-check':    '#c4a052',
  'talking-point': '#a86e6e',
  'answer':        '#9e7d5c',
  'clarification': '#8fa89e',
};

const TYPE_LABELS: Record<string, string> = {
  'question':      'Question',
  'fact-check':    'Fact Check',
  'talking-point': 'Talking Point',
  'answer':        'Answer',
  'clarification': 'Clarification',
};

function formatMS(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(startMs: number): string {
  const sec = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generatePdfHtml(data: PdfSessionData): string {
  const { segments, batches, messages, summary, latencyMetrics, sessionStartMs } = data;

  // ── Transcript section ────────────────────────────────────────────────────
  const transcriptHtml = segments.length === 0
    ? '<p class="empty">No transcript recorded.</p>'
    : segments.map((seg, i) => `
      <div class="segment">
        <div class="seg-meta">
          <span class="chunk-badge">Chunk ${i + 1}</span>
          <span class="seg-time">${formatDate(seg.timestamp)}</span>
        </div>
        <p class="seg-text">${esc(seg.text)}</p>
      </div>
    `).join('');

  // ── Suggestions section ────────────────────────────────────────────────────
  const suggestionsHtml = batches.length === 0
    ? '<p class="empty">No suggestions generated.</p>'
    : batches.slice(0, 8).map((batch, bi) => `
       <div class="batch">
         <div class="batch-header">
           <span class="batch-label">Batch ${batches.length - bi}</span>
           <span class="batch-time">${formatDate(batch.timestamp)}</span>
           ${batch.latencyMs ? `<span class="latency-badge">${formatMS(batch.latencyMs)}</span>` : ''}
         </div>
         <div class="cards">
           ${batch.suggestions.map((s) => {
             const color = TYPE_COLORS[s.type] ?? '#888';
             const label = TYPE_LABELS[s.type] ?? s.type;
             return `
               <div class="sug-card" style="border-left-color: ${color}">
                 <span class="type-badge" style="color:${color}; border-color:${color}40; background:${color}18">${esc(label)}</span>
                 <p class="sug-preview">${esc(s.preview)}</p>
               </div>
             `;
           }).join('')}
         </div>
       </div>
    `).join('');

  // ── Summary section ────────────────────────────────────────────────────────
  const summaryHtml = summary
    ? `<div class="summary-box"><p>${esc(summary)}</p></div>`
    : '<p class="empty">No summary generated.</p>';

  // ── Chat section ───────────────────────────────────────────────────────────
  const chatHtml = messages.length === 0
    ? '<p class="empty">No chat messages in this session.</p>'
    : messages.map((msg) => `
      <div class="chat-msg ${msg.role === 'user' ? 'user-msg' : 'ai-msg'}">
        <div class="msg-role">${msg.role === 'user' ? 'You' : 'TwinMind AI'}</div>
        <div class="msg-content">${esc(msg.content).replace(/\n/g, '<br>')}</div>
        <div class="msg-time">${formatDate(msg.timestamp)}</div>
      </div>
    `).join('');

  // ── Latency section ────────────────────────────────────────────────────────
  const perfHtml = `
    <table class="perf-table">
      <tr><td>Session Duration</td><td>${formatDuration(sessionStartMs)}</td></tr>
      <tr><td>Total Transcript Chunks</td><td>${segments.length}</td></tr>
      <tr><td>Total Suggestion Batches</td><td>${batches.length}</td></tr>
      <tr><td>Total Chat Messages</td><td>${messages.length}</td></tr>
      <tr><td>Last Suggestion Latency</td><td>${formatMS(latencyMetrics.lastSuggestionLatencyMs ?? null)}</td></tr>
      <tr><td>Avg Suggestion Latency</td><td>${formatMS(latencyMetrics.avgSuggestionLatencyMs ?? null)}</td></tr>
      <tr><td>Chat First Token</td><td>${formatMS(latencyMetrics.lastChatFirstTokenMs ?? null)}</td></tr>
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TwinMind Session Export — ${formatDate(Date.now())}</title>
  <style>
    /* ── Reset & base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: #1a1a18;
      background: #faf9f7;
    }

    /* ── Page ── */
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }

    /* ── Cover header ── */
    .cover {
      padding: 28px 0 20px;
      border-bottom: 3px solid #b89a5e;
      margin-bottom: 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .brand-logo-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-icon {
      width: 30px;
      height: 30px;
      background: linear-gradient(135deg, #b89a5e, #c4a96a);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-name {
      font-size: 18pt;
      font-weight: 800;
      color: #1a1a18;
      letter-spacing: -0.03em;
    }

    .brand-tag {
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #8a857c;
      margin-left: 38px;
    }

    .cover-meta {
      text-align: right;
      color: #8a857c;
      font-size: 8.5pt;
      line-height: 1.8;
    }

    .cover-meta strong { color: #1a1a18; }

    /* ── Section headers ── */
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 9pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #b89a5e;
      border-bottom: 1px solid #e5e0d8;
      padding-bottom: 4px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title svg { opacity: 0.7; }

    /* ── Summary box ── */
    .summary-box {
      background: #f5f0e8;
      border-left: 3px solid #b89a5e;
      border-radius: 4px;
      padding: 10px 14px;
      font-size: 9.5pt;
      color: #3a3830;
      line-height: 1.65;
    }

    /* ── Transcript ── */
    .segment {
      padding: 8px 0;
      border-bottom: 1px solid #ece8e0;
    }
    .segment:last-child { border-bottom: none; }

    .seg-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
    }

    .chunk-badge {
      font-size: 7pt;
      font-weight: 700;
      font-family: 'Consolas', monospace;
      color: #b89a5e;
      background: #f5edd8;
      border: 1px solid #d4ba80;
      border-radius: 3px;
      padding: 1px 6px;
    }

    .seg-time {
      font-size: 7.5pt;
      color: #8a857c;
      font-family: 'Consolas', monospace;
    }

    .seg-text {
      font-size: 9.5pt;
      color: #2a2a25;
      line-height: 1.65;
    }

    /* ── Suggestion batches ── */
    .batch {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }

    .batch-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .batch-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #7d9e7f;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .batch-time {
      font-size: 7.5pt;
      color: #8a857c;
    }

    .latency-badge {
      font-size: 7pt;
      color: #b89a5e;
      background: #f5edd8;
      border-radius: 3px;
      padding: 1px 5px;
      font-family: 'Consolas', monospace;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
    }

    .sug-card {
      background: #faf9f7;
      border: 1px solid #e5e0d8;
      border-left-width: 3px;
      border-radius: 5px;
      padding: 7px 9px;
    }

    .type-badge {
      display: inline-block;
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 1px solid;
      border-radius: 999px;
      padding: 1px 6px;
      margin-bottom: 4px;
    }

    .sug-preview {
      font-size: 8.5pt;
      color: #2a2a25;
      line-height: 1.5;
    }

    /* ── Chat ── */
    .chat-msg {
      padding: 8px 10px;
      border-radius: 5px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }

    .user-msg {
      background: #f5edd8;
      border: 1px solid #d4ba80;
      margin-left: 40px;
    }

    .ai-msg {
      background: #f0f0ec;
      border: 1px solid #dddad4;
      margin-right: 40px;
    }

    .msg-role {
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8a857c;
      margin-bottom: 3px;
    }

    .user-msg .msg-role { color: #b89a5e; }
    .ai-msg  .msg-role  { color: #7d9e7f; }

    .msg-content {
      font-size: 9pt;
      color: #2a2a25;
      line-height: 1.6;
    }

    .msg-time {
      font-size: 7pt;
      color: #a0998f;
      margin-top: 3px;
      font-family: 'Consolas', monospace;
    }

    /* ── Performance table ── */
    .perf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .perf-table tr:nth-child(odd) td { background: #f5f0e8; }

    .perf-table td {
      padding: 5px 10px;
      border: 1px solid #e5e0d8;
      color: #2a2a25;
    }

    .perf-table td:first-child {
      font-weight: 600;
      color: #5a5750;
      width: 55%;
    }

    .perf-table td:last-child {
      font-family: 'Consolas', monospace;
      color: #b89a5e;
      font-weight: 700;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e0d8;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #a0998f;
    }

    .footer strong { color: #b89a5e; }

    .empty {
      color: #a0998f;
      font-style: italic;
      font-size: 9pt;
    }

    /* ── Print overrides ── */
    @media print {
      body { background: #fff; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>

  <!-- Print button (disappears during print) -->
  <div class="no-print" style="
    position: fixed; top: 16px; right: 16px;
    display: flex; gap: 10px; z-index: 100;
  ">
    <button onclick="window.print()" style="
      background: #b89a5e; color: #fff; border: none;
      border-radius: 7px; padding: 9px 20px; font-size: 13px;
      font-weight: 700; cursor: pointer; font-family: inherit;
      box-shadow: 0 2px 8px rgba(184,154,94,0.3);
    ">⬇ Save as PDF</button>
    <button onclick="window.close()" style="
      background: #f0f0ec; color: #5a5750; border: 1px solid #dddad4;
      border-radius: 7px; padding: 9px 16px; font-size: 13px;
      font-weight: 600; cursor: pointer; font-family: inherit;
    ">Close</button>
  </div>

  <!-- Cover -->
  <div class="cover">
    <div class="brand">
      <div class="brand-logo-row">
        <div class="brand-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 3a4 4 0 0 1 6 3.46V21"/><path d="M3 9a4 4 0 0 1 6-3.46"/>
            <path d="M3 9c0 2.21 1.79 4 4 4h10a4 4 0 0 0 0-8H7"/>
            <path d="M9 21H7a4 4 0 0 1 0-8"/><path d="M15 21h2a4 4 0 0 0 0-8"/>
          </svg>
        </div>
        <span class="brand-name">TwinMind</span>
      </div>
      <span class="brand-tag">Live Meeting Copilot — Session Export</span>
    </div>
    <div class="cover-meta">
      <strong>Exported</strong><br>${formatDate(Date.now())}<br>
      <strong>Session started</strong><br>${formatDate(sessionStartMs)}<br>
      <strong>Duration</strong> ${formatDuration(sessionStartMs)}
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="section-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Conversation Summary
    </div>
    ${summaryHtml}
  </div>

  <!-- Transcript -->
  <div class="section">
    <div class="section-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
      Transcript (${segments.length} chunk${segments.length !== 1 ? 's' : ''})
    </div>
    ${transcriptHtml}
  </div>

  <!-- Suggestions -->
  <div class="section">
    <div class="section-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      AI Suggestions (${batches.length} batch${batches.length !== 1 ? 'es' : ''})
    </div>
    ${suggestionsHtml}
  </div>

  <!-- Chat -->
  <div class="section">
    <div class="section-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Chat History (${messages.length} message${messages.length !== 1 ? 's' : ''})
    </div>
    ${chatHtml}
  </div>

  <!-- Performance -->
  <div class="section">
    <div class="section-title">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Performance Metrics
    </div>
    ${perfHtml}
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Generated by <strong>TwinMind</strong> Live Meeting Copilot</span>
    <span>Powered by Groq · Whisper · ${formatDate(Date.now())}</span>
  </div>

</body>
</html>`;
}

/**
 * Opens a beautifully styled print window and triggers the Save as PDF dialog.
 */
export function exportToPdf(data: PdfSessionData): void {
  const html = generatePdfHtml(data);
  const win = window.open('', '_blank', 'width=900,height=700,toolbar=0,menubar=0');
  if (!win) {
    alert('Popup blocked — please allow popups for this site to export PDF.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // Small delay so the browser has time to render before print dialog
  setTimeout(() => win.focus(), 300);
}
