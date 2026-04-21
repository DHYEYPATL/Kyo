// ─── Meeting Phase Detection ──────────────────────────────────────────────────
//
// Detects the current meeting phase from transcript signals + elapsed time.
// Used to adjust suggestion strategy: different phases need different types.
//
// Phases:
//   opening         → first ~3 min, intros, agenda setting
//   problem-framing → identifying issues, defining scope
//   debate          → competing ideas, pushback, fact disputes
//   decision        → converging on choices, trade-off discussion
//   closing         → wrapping up, action items, next steps

export type MeetingPhase =
  | 'opening'
  | 'problem-framing'
  | 'debate'
  | 'decision'
  | 'closing';

// ── Keyword signal maps ────────────────────────────────────────────────────────

const PHASE_SIGNALS: Record<MeetingPhase, string[]> = {
  opening: [
    'welcome', 'introduce', 'agenda', 'today we', 'quick intro',
    'nice to meet', 'good morning', 'good afternoon', 'let\'s get started',
    'call to order', 'join', 'joining', 'hello everyone',
  ],
  'problem-framing': [
    'the problem is', 'issue', 'challenge', 'pain point', 'bottleneck',
    'struggling', 'we need to', 'current state', 'as-is', 'root cause',
    'why are we', 'what\'s causing', 'define', 'scope', 'objective',
  ],
  debate: [
    'i disagree', 'i don\'t think', 'but actually', 'however',
    'on the other hand', 'counterpoint', 'wait', 'hold on',
    'that\'s not right', 'are you sure', 'actually', 'versus',
    'alternative', 'pushback', 'concern', 'risk', 'downside',
  ],
  decision: [
    'i think we should', 'let\'s go with', 'we\'ve decided',
    'the plan is', 'moving forward', 'agreed', 'consensus',
    'vote', 'finalize', 'approve', 'sign off', 'proceed',
    'trade-off', 'option a', 'option b',
  ],
  closing: [
    'action item', 'next steps', 'follow up', 'who owns',
    'responsible for', 'by when', 'deadline', 'wrap up',
    'in summary', 'to summarize', 'before we end', 'any questions',
    'that\'s all', 'thanks everyone', 'great meeting',
  ],
};

// ── Suggestion strategy per phase ─────────────────────────────────────────────

export const PHASE_SUGGESTION_STRATEGY: Record<MeetingPhase, string> = {
  opening:
    'Focus on clarification (undefined terms, unstated assumptions) and questions that uncover the real agenda. Avoid fact-checks on things not yet stated.',
  'problem-framing':
    'Prioritize questions that expose hidden assumptions and a talking-point that reframes the problem. One fact-check if a specific claim was made.',
  debate:
    'Prioritize fact-checks on disputed claims, and a strong counterpoint or alternative angle. One answer if a direct question was just asked.',
  decision:
    'Lead with a talking-point covering the biggest unconsidered risk. Include one answer that addresses the strongest objection, and one clarification on any vague commitment.',
  closing:
    'Lead with an action-item extraction talking-point. Include an accountability question (who/when) and a clarification on any undefined next step.',
};

export const PHASE_LABELS: Record<MeetingPhase, string> = {
  opening: '👋 Opening',
  'problem-framing': '🔍 Problem Framing',
  debate: '⚡ Debate',
  decision: '✅ Decision',
  closing: '🏁 Closing',
};

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Lightweight heuristic phase classifier.
 * Counts signal hits per phase in the recent transcript + considers elapsed time.
 * Returns the phase with the strongest signal, with time-based tie-breaking.
 */
export function detectMeetingPhase(
  recentText: string,
  summary: string,
  elapsedSeconds: number
): MeetingPhase {
  const text = (recentText + ' ' + summary).toLowerCase();
  const words = text.split(/\s+/);

  // Count keyword hits per phase
  const scores: Record<MeetingPhase, number> = {
    opening: 0,
    'problem-framing': 0,
    debate: 0,
    decision: 0,
    closing: 0,
  };

  for (const [phase, signals] of Object.entries(PHASE_SIGNALS) as [MeetingPhase, string[]][]) {
    for (const signal of signals) {
      const signalWords = signal.split(' ');
      if (signalWords.length === 1) {
        scores[phase] += words.filter((w) => w === signal).length;
      } else {
        // multi-word phrase check
        if (text.includes(signal)) scores[phase] += 2;
      }
    }
  }

  // Time-based priors — boost phase likelihood based on elapsed time
  if (elapsedSeconds < 180) scores['opening'] += 3;
  else if (elapsedSeconds < 600) scores['problem-framing'] += 1;
  if (elapsedSeconds > 900) scores['closing'] += 1;

  // Pick highest-scoring phase
  const best = (Object.keys(scores) as MeetingPhase[]).reduce((a, b) =>
    scores[a] >= scores[b] ? a : b
  );

  // Default to problem-framing if scores are all zero (mid-meeting)
  return scores[best] === 0 ? 'problem-framing' : best;
}
