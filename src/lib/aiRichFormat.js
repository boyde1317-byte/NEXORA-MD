/**
 * aiRichFormat.js — makes AI answers use the rich response renderer.
 *
 * The renderer (aiRichReply → AIRich → richResponseMessage) can paint text,
 * native tables, code cards, LaTeX and suggestion pills. A model only fills
 * those slots if it is told they exist, and only reaches for a table when the
 * question is actually a comparison. So this module supplies the two halves:
 *
 *   1. RICH_FORMAT_CONTRACT — the rendering rules appended to the system
 *      prompt while capabilities.richResponse is on.
 *   2. detectRichIntent() — per-turn shape detection. "iPhone vs S24" gets a
 *      hard directive to answer as a pipe table; a poem gets nothing, so the
 *      model is never nudged into tabulating prose.
 *
 * With rich responses off (NEXORA_RICH_RESPONSE=0) the base prompt is returned
 * untouched: the bot's plain-text path must not advertise tables it cannot
 * render.
 */
import { capabilities } from '../core/capabilities.js';
import { NEXORA_SYSTEM_PROMPT } from '../nexora-ai-prompt.js';

/** Rules the model must follow when the reply is painted by AIRich. */
export const RICH_FORMAT_CONTRACT = [
  'RENDERING — this chat can paint tables, code cards, LaTeX and lists. Pick the shape that fits the task the user gave you. Do not use a shape just because it exists.',
  '- A pipe table is for ONE case: the user is comparing 2+ named options, or they explicitly asked for a table/breakdown. Row 1 = header, and its first cell must name the row axis (Feature, Spec, Price); remaining cells are the option names (2-4 options). Row 2 = separator (|---|). Then at most 8 attribute rows, one short value per cell (1-4 words), no sentences or links inside cells. End with one line: *Verdict:* <pick> — <one reason>.',
  '- NEVER table a single subject: a person, a place, a company, one product on its own, a story, an explanation or code. Something having many attributes does not make it a comparison.',
  '- Answer the task as it was asked. About a person, company, place or topic: a short *bold* title line, then 3-5 "-" bullets of the facts that matter, then one line of context. Explaining something: 2-3 short paragraphs. A recommendation or opinion: 2-4 sentences. Enumerable facts: bullets.',
  '- Code: exactly one fenced block tagged with its language (```python). Code never goes inside a table cell.',
  '- Math: LaTeX between $...$. Never use LaTeX for prices or plain words.',
  '- A procedure or how-to: numbered list (1. 2. 3.), max 8 steps, one line each.',
  '- No "#" or "##" headings — open with a short *bold* line instead.',
  '- Emphasis: single asterisks for *bold* and single underscores for _italic_ (WhatsApp markup; **double** asterisks and __double__ underscores arrive as literal characters).',
].join('\n');

/** Per-shape directives. Only the matched shape is appended. */
const SHAPE_NOTES = {
  comparison: [
    'THIS TURN: the user is comparing options.',
    'Reply with exactly one pipe table (attributes down the side, one column per option), then a single *Verdict:* line naming the best pick and why.',
    'Do not answer this turn in prose and do not repeat the table in words.',
    'If the compared items are missing real data (price, spec you are unsure of), say so inside the verdict line instead of inventing cells.',
  ].join(' '),
  table: [
    'THIS TURN: the user asked for tabular data.',
    'Reply with one pipe table: descriptive header row, realistic but honest cells, max 8 rows and 4 columns.',
    'Add at most one sentence before the table; no prose paragraphs after it.',
  ].join(' '),
  steps: [
    'THIS TURN: the user wants a procedure.',
    'Reply with a numbered list (1. 2. 3.), max 8 steps, one line each, in the order they must be done.',
    'Do not use a table for steps.',
  ].join(' '),
  profile: [
    'THIS TURN: the user asked about one subject (a person, company, place or thing).',
    'Do NOT use a table — this is not a comparison.',
    'Open with a short *bold* line naming it, then 3-5 "-" bullets covering what it is, what it is known for, key dates/numbers and current status where relevant, then one closing line that answers why it matters for the user\'s question.',
    'Only state facts you are confident of. If you do not know the subject, say so in one sentence instead of inventing a profile.',
  ].join(' '),
};

/** Ordered: the first match wins, so comparison beats the generic shapes. */
const INTENT_PATTERNS = [
  {
    shape: 'comparison',
    re: /\bversus\b|\bvs\.?(?=\s|$)|\bcompar(e|es|ed|ing|ison|isons)\b|\bdiff(erence|erences?)?\s+between\b|\b(which|what)\s+(one\s+)?(is|should\s+i)\s+(better|best|buy|get|choose|pick)\b|\bpros\s*(and|\/|&)\s*cons\b|\bbetter\s+than\b|\bshould\s+i\s+(buy|get|choose|pick)\b/i,
  },
  {
    shape: 'table',
    re: /\b(table|tabular|side[-\s]?by[-\s]?side|matrix|grid|breakdown)\b/i,
  },
  {
    shape: 'steps',
    re: /(^|\s)(how\s+(do|to|can)\b|steps?\b|guide\b|walkthrough\b|set\s?up\b|configure\b|install\b)/i,
  },
  {
    shape: 'profile',
    re: /\bwho\s+(is|was|are|were)\b|\b(info|information)\s+(on|about)\b|\btell\s+me\s+(more\s+)?about\b|\bprofile\s+(of|on)\b|\bbiography\b|\bbackground\s+(on|of)\b|\bexplain\b|\bhistory\s+of\b/i,
  },
];

/**
 * Work out which rich shape (if any) fits this prompt.
 *
 * Only a real comparison (or an explicit table request) is allowed to force a
 * table. Everything else is shaped by the task: a procedure becomes a numbered
 * list, a single subject becomes a titled bullet answer, and plain chat gets no
 * directive at all.
 *
 * @param {string} prompt
 * @returns {{ shape: 'comparison'|'table'|'steps'|'profile'|null, directive: string|null }}
 */
export function detectRichIntent(prompt) {
  const text = String(prompt || '');
  if (!text.trim()) return { shape: null, directive: null };

  for (const { shape, re } of INTENT_PATTERNS) {
    if (re.test(text)) {
      // A how-to that also says "compare" is still a procedure; keep the
      // comparison directive only when the prompt names two sides.
      if (shape === 'comparison' && /\bhow\s+(do|to|can)\b/i.test(text) && !/[\w-]\s+(vs\.?|versus)\s+[\w-]/i.test(text)) {
        continue;
      }
      return { shape, directive: SHAPE_NOTES[shape] || null };
    }
  }

  return { shape: null, directive: null };
}

/**
 * Build the system instruction for one turn.
 *
 * @param {string} prompt  the user's message (drives shape detection)
 * @param {object} [opts]
 * @param {string} [opts.base]  base persona prompt
 * @param {boolean} [opts.rich] force rich on/off (default: runtime capability)
 * @param {string} [opts.extra] extra task rules appended last (e.g. .code rules)
 * @returns {string}
 */
export function buildAISystemPrompt(prompt, { base = NEXORA_SYSTEM_PROMPT, rich, extra } = {}) {
  const richOn = rich === undefined ? !!capabilities.richResponse : !!rich;
  const parts = [String(base || '').trim()];

  if (richOn) {
    parts.push(RICH_FORMAT_CONTRACT);
    const { directive } = detectRichIntent(prompt);
    if (directive) parts.push(directive);
  }
  if (extra) parts.push(String(extra).trim());

  return parts.filter(Boolean).join('\n\n');
}

export default { RICH_FORMAT_CONTRACT, buildAISystemPrompt, detectRichIntent };
