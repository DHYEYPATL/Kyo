// ─── Named Entity Highlighting ────────────────────────────────────────────────
//
// Client-side heuristic NER — no API call needed.
// Tags numbers, percentages, monetary values, dates/quarters, and
// proper-noun sequences with CSS class markers for colored rendering.

export type EntityType = 'number' | 'date' | 'person' | 'money';

// Order matters — earlier patterns take precedence.
const ENTITY_PATTERNS: Array<{ type: EntityType; pattern: RegExp }> = [
  // Money: $1.2M, $240K, £500, €1,000
  {
    type: 'money',
    pattern: /(?:(?:\$|€|£|¥)\s?\d[\d,.]*)(?:[KMBkmb]b?)?|\d[\d,.]*(?:\s?(?:million|billion|trillion|thousand))/gi,
  },
  // Percentages and plain numbers with units
  {
    type: 'number',
    pattern: /\b\d[\d,.]*\s?%|\b\d[\d,.]*(?:\s?[KMBkmb]b?)?\b/g,
  },
  // Quarters, fiscal years, years
  {
    type: 'date',
    pattern: /\b(?:Q[1-4]\s?\d{0,4}|FY\s?\d{2,4}|H[12]\s?\d{0,4}|20\d{2}|19\d{2})\b/g,
  },
  // Proper nouns (Title Case sequences ≥ 2 words, avoiding sentence starts)
  {
    type: 'person',
    pattern: /\b(?:[A-Z][a-z]{1,}(?:\s[A-Z][a-z]{1,}){1,3})\b/g,
  },
];

const TYPE_CLASSES: Record<EntityType, string> = {
  money:  'entity-money',
  number: 'entity-number',
  date:   'entity-date',
  person: 'entity-person',
};

/**
 * Injects <mark> tags around detected entities in plain text.
 * Safe: only uses CSS classes, no inline styles. Use in dangerouslySetInnerHTML
 * only on trusted sources (our own Whisper transcripts).
 */
export function highlightEntities(text: string): string {
  if (!text) return '';

  // Track replaced ranges to avoid overlapping matches
  const replacements: Array<{ start: number; end: number; html: string }> = [];

  for (const { type, pattern } of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Skip if already covered by a prior match
      const overlaps = replacements.some((r) => start < r.end && end > r.start);
      if (overlaps) continue;

      const cls = TYPE_CLASSES[type];
      replacements.push({
        start,
        end,
        html: `<mark class="${cls}">${match[0]}</mark>`,
      });
    }
  }

  if (replacements.length === 0) return text;

  // Sort by position and reconstruct string
  replacements.sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;

  for (const { start, end, html } of replacements) {
    result += text.slice(cursor, start) + html;
    cursor = end;
  }
  result += text.slice(cursor);

  return result;
}
