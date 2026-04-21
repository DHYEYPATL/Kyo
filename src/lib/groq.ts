import { Suggestion, ChatMessage } from '@/types';

// ─── Warm-up (Pre-warm the Groq connection) ───────────────────────────────────
// Fires a 1-token request 10s before a chunk boundary to eliminate cold-start
// HTTP/TLS latency from the real suggestion call.

export function prewarmGroqConnection(apiKey: string, model: string): void {
  fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: '.' }],
      max_tokens: 1,
    }),
  }).catch(() => {}); // fire-and-forget; failures are intentionally silent
}

// ─── Transcription ────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  model: string,
  language?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model);
  formData.append('response_format', 'json');
  if (language && language !== 'auto') {
    formData.append('language', language);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.text as string).trim();
}

// ─── Transcription with retry + WAV fallback (#8, #10) ───────────────────────
// Retries up to maxAttempts with exponential backoff.
// On the 2nd attempt, re-packages as a named .wav to satisfy Safari/Firefox
// which sometimes produce malformed webm containers.

export async function transcribeWithRetry(
  audioBlob: Blob,
  apiKey: string,
  model: string,
  language?: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // On 2nd+ attempt use a .wav MIME hint for better server-side handling
      const blob =
        attempt > 0
          ? new Blob([await audioBlob.arrayBuffer()], { type: 'audio/wav' })
          : audioBlob;

      const text = await transcribeAudio(blob, apiKey, model, language);
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on permission or auth errors
      const msg = lastError.message.toLowerCase();
      if (msg.includes('401') || msg.includes('permission') || msg.includes('denied')) {
        throw lastError;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError ?? new Error('Transcription failed after retries');
}

// ─── Rolling Summary ──────────────────────────────────────────────────────────

export async function generateSummary(
  transcriptText: string,
  summaryPrompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const prompt = summaryPrompt.replace('{transcript}', transcriptText);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Summary failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.choices[0].message.content as string).trim();
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export async function fetchSuggestions(
  recentChunks: string,
  summary: string,
  systemPrompt: string,
  apiKey: string,
  model: string,
  avoidPreviews?: string[],  // #3: avoided-suggestion memory
  phaseInstruction?: string  // #1: meeting-phase strategy
): Promise<{ suggestions: Omit<Suggestion, 'id' | 'timestamp'>[]; latencyMs: number }> {
  const startMs = Date.now();

  const systemContent = systemPrompt
    .replace('{recentChunks}', '')
    .replace('{summary}', '');

  // Build avoid block (#3)
  const avoidBlock =
    avoidPreviews && avoidPreviews.length > 0
      ? `<avoid>\nDo NOT repeat or rephrase these recent suggestions — they are already visible to the user:\n- ${avoidPreviews.join('\n- ')}\n</avoid>`
      : '';

  // Build phase block (#1)
  const phaseBlock = phaseInstruction
    ? `<meeting_phase_strategy>\n${phaseInstruction}\n</meeting_phase_strategy>`
    : '';

  const userContent = [
    summary
      ? `<prior_summary>${summary}</prior_summary>`
      : '<prior_summary>No prior summary — early in conversation.</prior_summary>',
    `<recent_transcript>${recentChunks}</recent_transcript>`,
    phaseBlock,
    avoidBlock,
    'Generate exactly 3 suggestions now. Return ONLY the JSON object.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Suggestions failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;
  const parsed = JSON.parse(content) as { suggestions: Omit<Suggestion, 'id' | 'timestamp'>[] };

  const suggestions = (parsed.suggestions ?? []).slice(0, 3);

  const validated = suggestions.map((s) => ({
    type: (['question', 'fact-check', 'talking-point', 'answer', 'clarification'].includes(s.type)
      ? s.type
      : 'talking-point') as Suggestion['type'],
    preview: s.preview?.trim() || 'See details for more information.',
    detailsHint: s.detailsHint?.trim() || 'Expand on this topic',
    isPinned: false,
  }));

  return { suggestions: validated, latencyMs: Date.now() - startMs };
}

// ─── Chat (streaming) ─────────────────────────────────────────────────────────

export async function streamChatResponse(
  userMessage: string,
  recentTranscript: string,
  summary: string,
  chatHistory: ChatMessage[],
  systemPrompt: string,
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();
  let firstTokenMs: number | null = null;

  const systemContent = [
    systemPrompt,
    summary ? `\n\nConversation summary:\n${summary}` : '',
    `\n\nRecent transcript:\n${recentTranscript}`,
  ].join('');

  const messages = [
    { role: 'system' as const, content: systemContent },
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1500,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chat failed (${response.status}): ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        onDone(firstTokenMs ?? Date.now() - startMs);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
          onToken(token);
        }
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  onDone(firstTokenMs ?? Date.now() - startMs);
}

// ─── Follow-up Question Generator ────────────────────────────────────────────

export async function generateFollowUpQuestions(
  assistantResponse: string,
  summary: string,
  prompt: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  const filledPrompt = prompt
    .replace('{response}', assistantResponse.slice(0, 2000))
    .replace('{summary}', summary || 'No prior summary.');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: filledPrompt }],
        temperature: 0.6,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content as string);
    const qs = parsed.questions;
    if (!Array.isArray(qs)) return [];
    return qs.filter((q: unknown) => typeof q === 'string').slice(0, 3);
  } catch {
    return [];
  }
}

// ─── Detailed Answer (streaming) ──────────────────────────────────────────────

export async function streamDetailedAnswer(
  suggestion: Suggestion,
  recentTranscript: string,
  summary: string,
  detailedAnswerPrompt: string,
  apiKey: string,
  model: string,
  onToken: (token: string) => void,
  onDone: (latencyMs: number) => void
): Promise<void> {
  const startMs = Date.now();
  let firstTokenMs: number | null = null;

  const prompt = detailedAnswerPrompt
    .replace('{type}', suggestion.type)
    .replace('{preview}', suggestion.preview)
    .replace('{summary}', summary || 'No prior summary.')
    .replace('{recentTranscript}', recentTranscript);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Detailed answer failed (${response.status}): ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        onDone(firstTokenMs ?? Date.now() - startMs);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startMs;
          onToken(token);
        }
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  onDone(firstTokenMs ?? Date.now() - startMs);
}

// ─── API Key Validation (#23) ─────────────────────────────────────────────────

export async function validateGroqApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
