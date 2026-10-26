/**
 * aiQuote.js — fixed AI-persona quote strip for rich replies.
 *
 * Uses the Yuzuki "verified quote" pattern: instead of quoting a
 * participant JID (which only shows a saved contact's name), the synthetic
 * quote is a contactMessage vcard — WhatsApp renders the vcard's
 * displayName directly in the quote header, so the persona name shows on
 * every device with zero contact setup.
 *
 * Personas are ASSIGNED BY REPLY KIND — no rotation. Each reply type
 * always speaks with the same voice, so users learn what a strip means:
 *
 *   💬 ChatGPT    conversation    plain m.reply text (AI command outputs,
 *                                 simi, translate results, answers)
 *   🤖 Meta AI    operational     success, loading, box panels, interactive
 *                                 cards (menus, action cards), errors
 *   🔎 Perplexity guidance        info (usage/help), warn (cautions,
 *                                 cooldowns)
 *
 * Numbers:
 *   Meta AI     +1 (313) 555-0002 (waid 13135550002) — override with
 *               META_AI_NUMBER in .env if you prefer another.
 *   ChatGPT     +1 800 242 8478   — official OpenAI WhatsApp number
 *   Perplexity  +1 833 436 3285   — official Perplexity WhatsApp number
 *
 * Usage: the serializer's replyFn passes the reply kind, and interactiveKit
 * passes 'card'. Plugins can override with their own `quoted` in the reply
 * options when a real quote is needed.
 */

const PERSONAS = {
  metaai: {
    name: 'Meta AI',
    emoji: '🤖',
    waid: process.env.META_AI_NUMBER || '13135550002',
    tel: `+1 (${(process.env.META_AI_NUMBER || '13135550002').slice(1, 4)}) ${(process.env.META_AI_NUMBER || '13135550002').slice(4, 7)}-${(process.env.META_AI_NUMBER || '13135550002').slice(7)}`,
    label: 'Ponsel',
  },
  chatgpt: {
    name: 'ChatGPT',
    emoji: '💬',
    waid: '18002428478',
    tel: '+1 (800) 242-8478',
    label: 'Ponsel',
  },
  perplexity: {
    name: 'Perplexity',
    emoji: '🔎',
    waid: '18334363285',
    tel: '+1 (833) 436-3285',
    label: 'Ponsel',
  },
};

/** Reply kind -> persona key. Unknown kinds fall back to 'chatgpt'. */
const KIND_PERSONA = {
  default:     'chatgpt',   // plain m.reply — conversational/AI output voice
  success:     'metaai',
  loading:     'metaai',
  box:         'metaai',
  card:        'metaai',    // interactiveKit cards (menus, action cards)
  error:       'metaai',
  info:        'perplexity',
  warn:        'perplexity',
};

/**
 * Build a synthetic `quoted` — a verified-style contact card attributed to
 * the persona assigned to this reply kind. Deterministic: the same kind
 * always produces the same persona. The `m` argument is accepted for
 * call-site compatibility but unused: the strip renders the vcard
 * displayName.
 */
export function aiQuoted(m, kind = 'default') {
  const persona = PERSONAS[KIND_PERSONA[kind] ?? KIND_PERSONA.default];
  return {
    key: {
      participant: '0@s.whatsapp.net',
      remoteJid: 'status@broadcast',
    },
    message: {
      contactMessage: {
        displayName: `${persona.emoji} ${persona.name}`,
        vcard: [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:;${persona.name};;;`,
          `FN:${persona.name}`,
          `item1.TEL;waid=${persona.waid}:${persona.tel}`,
          `item1.X-ABLabel:${persona.label}`,
          'END:VCARD',
        ].join('\n'),
      },
    },
  };
}
