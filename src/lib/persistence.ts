// ─── Session Persistence (IndexedDB) ─────────────────────────────────────────
//
// Persists the full session state to IndexedDB via idb-keyval.
// This is separate from Settings (which stays in localStorage) so we can
// store large transcript + chat history without hitting localStorage quota.

import { get, set, del } from 'idb-keyval';
import { TranscriptSegment, SuggestionBatch, ChatMessage } from '@/types';

const DB_KEY = 'twinmind_session_v1';

export interface PersistedSession {
  savedAt: number;
  segments: TranscriptSegment[];
  summary: string;
  batches: SuggestionBatch[];
  messages: ChatMessage[];
  sessionStartMs: number;
}

export async function saveSession(data: PersistedSession): Promise<void> {
  try {
    await set(DB_KEY, data);
  } catch {
    // Ignore — persistence is best-effort
  }
}

export async function loadSession(): Promise<PersistedSession | null> {
  try {
    const data = await get<PersistedSession>(DB_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await del(DB_KEY);
  } catch {
    // Ignore
  }
}
