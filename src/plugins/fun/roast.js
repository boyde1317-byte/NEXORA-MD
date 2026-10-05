/**
 * roast.js — playful roast generator.
 *
 * Two tiers:
 *   1. AI roast via the shared AI client (works with a free Groq key) —
 *      the model is instructed to stay witty, PG-13 and affectionate:
 *      punch at habits, never at identity.
 *   2. No AI configured? An original local one-liner list keeps the
 *      command alive in any group.
 *
 * Styles: default | savage | gentle
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { aiTextGenerator, clearConversation } from '../../assets/aiTextGenerator.js';

const LOCAL_ROASTS = [
  'Your phone battery lasts longer than your motivation.',
  'You type "lol" with a straight face. We all know. We can feel it.',
  'Your last seen is "online" because even your WiFi is embarrassed.',
  'You save memes faster than you save money.',
  'You have 47 drafts and zero sent messages. The coward era continues.',
  'Your typing speed is impressive. Your decision-making, less so.',
  'You mute the group but still read everything. We see you lurking.',
  'You say "I\'m on my way" from the bed. The bed knows the truth.',
];

const SAVAGE_ROASTS = [
  'Your confidence has no business being that high with that typing speed.',
  'You give advice like someone who has never taken any.',
  'You\'re not the main character. You\'re not even the trailer. You\'re the "based on" part.',
  'Your "quick question" takes longer than a government form.',
];

const GENTLE_ROASTS = [
  'You\'re doing amazing sweetie — the bar was on the floor, but still.',
  'Bless your heart, and your typing accuracy. Mostly your heart.',
  'You\'re a masterpiece in progress. Heavy emphasis on progress.',
];

const STYLE_PROMPTS = {
  savage: 'Go full savage — sharp and merciless but still funny and clean.',
  gentle: 'Be soft and affectionate — roast like a best friend who loves them.',
  default: 'Be witty and playful.',
};

const STYLE_LOCAL = { savage: SAVAGE_ROASTS, gentle: GENTLE_ROASTS, default: LOCAL_ROASTS };

export default {
  name: 'roast',
  aliases: ['fry', 'diss'],
  category: 'fun',
  description: 'Roasts someone (all love, no real damage). Styles: default / savage / gentle.',
  cooldown: 6000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const mentions = m.msg?.contextInfo?.mentionedJid ?? [];
    const target = mentions[0] || m.quoted?.sender || null;
    const targetIsSelf = !target || target === m.sender;

    // Optional style keyword
    const rawArgs = args.join(' ').toLowerCase();
    let style = 'default';
    if (rawArgs.includes('savage')) style = 'savage';
    else if (rawArgs.includes('gentle')) style = 'gentle';

    if (!target && !targetIsSelf) {
      return await m.reply.info(
        `Usage: \`${p}roast @person [savage|gentle]\`\nOr reply to their message with \`${p}roast\`.`,
        'NEXORA • Roast'
      );
    }

    await withReactionStatus(m, async () => {
      let roastText = null;
      let aiPowered = false;

      // ── Tier 1: AI roast ────────────────────────────────────────────
      if (aiTextGenerator.isEnabled()) {
        try {
          await m.reply.loading('Sharpening the knives…');
          const who = targetIsSelf
            ? 'the person sending this command (they are roasting THEMSELVES, respect that energy)'
            : 'the mentioned target';
          const prompt =
            `Write ONE short roast line (max 25 words) about ${who}. ` +
            `${STYLE_PROMPTS[style]} It must be funny, PG-13, and affectionate under the edge. ` +
            'Never mention appearance, race, religion, gender or anything protected. ' +
            'Punch at habits (typing speed, lurking, last-seen games), not identity. ' +
            'Reply with the roast line only, no quotes, no preamble.';
          roastText = (await aiTextGenerator.generateText(prompt, { senderJid: m.sender })).trim();
          // One-shot: don't let roast prompts pollute the .ai conversation memory
          clearConversation(m.sender);
          if (roastText) aiPowered = true;
        } catch (_) {
          roastText = null; // fall through to local
        }
      }

      // ── Tier 2: local fallback ──────────────────────────────────────
      if (!roastText) {
        const pool = STYLE_LOCAL[style];
        roastText = pool[Math.floor(Math.random() * pool.length)];
      }

      const tag = targetIsSelf ? 'yourself' : `@${target.split('@')[0].split(':')[0]}`;
      const label = style === 'default' ? '🔥 Roast' : style === 'savage' ? '🌶️ Savage Roast' : '🥺 Gentle Roast';
      const power = aiPowered ? 'AI-powered' : 'house special';

      const text =
        `${label} — *${tag}*\n\n` +
        `🔪 ${roastText}\n\n` +
        `_Served fresh • ${power}_${targetIsSelf ? '\n_Still the bravest move in the group._' : ''}`;

      await actionCard(sock, m.from, { text, footer: 'NEXORA • Roast 🔥' },
        [
          { kind: 'action', label: '🔥 Roast Again', cmd: `${p}roast${targetIsSelf ? '' : ' ' + tag}` },
          { kind: 'action', label: '🥺 Gentle Mode', cmd: `${p}roast gentle` },
        ],
        { quoted: m, mentions: targetIsSelf ? [] : [target] });

      await m.react('🔥');
    });
  }
};
