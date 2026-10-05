/**
 * vibe.js — aura / vibe check.
 *
 * The reading is STABLE per person (not per day): your aura is your aura,
 * and it only changes if you genuinely change (or your JID does).
 * Big meters, colors, and a one-line verdict. Pure entertainment —
 * the "aura" comes from a hash, not from a person.
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

const COLORS = [
  { name: 'Neon Gold', emoji: '🟨', note: 'main character energy, zero irony' },
  { name: 'Deep Ocean', emoji: '🟦', note: 'mysterious but everyone trusts you' },
  { name: 'Ember Red', emoji: '🟥', note: 'chaotic, but make it fashion' },
  { name: 'Cosmic Purple', emoji: '🟪', note: 'you know things before they happen' },
  { name: 'Jade Green', emoji: '🟩', note: 'certified good vibes distributor' },
  { name: 'Void Black', emoji: '⬛', note: 'unbothered, moisturized, in your lane' },
  { name: 'Sunset Orange', emoji: '🟧', note: 'the group chat warms up when you enter' },
];

const TRAITS = [
  'typing speed', 'last-seen games', 'meme taste', 'music library',
  'voice note timing', 'streak discipline', 'typing "k"', 'bombs per day',
  'clapback accuracy', 'reaction speed',
];

function stableHash(str) {
  let h = 0;
  for (const ch of str) h = (Math.imul(31, h) + ch.charCodeAt(0)) >>> 0;
  return h;
}

function meter(pct, len = 10) {
  const filled = Math.round((pct / 100) * len);
  return '🟩'.repeat(filled) + '⬜'.repeat(len - filled);
}

function verdict(pct) {
  if (pct >= 90) return 'Untouchable aura. Do not text them first — they KNOW.';
  if (pct >= 75) return 'Elite vibes. The group is lucky to have you.';
  if (pct >= 60) return 'Solid aura. Keep watering it.';
  if (pct >= 45) return 'Decent vibes, one bad habit away from greatness.';
  if (pct >= 30) return 'Aura is under maintenance. Touch grass, then retry.';
  if (pct >= 15) return 'The aura is on holiday. It left no return date.';
  return 'Aura so low it\'s in the negatives. Legendary in its own way.';
}

export default {
  name: 'vibe',
  aliases: ['aura', 'vibecheck'],
  category: 'fun',
  description: 'Checks someone\'s aura and vibe. Stable reading — your aura doesn\'t change because you asked twice.',
  cooldown: 4000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const mentions = m.msg?.contextInfo?.mentionedJid ?? [];
    const target = mentions[0] || m.quoted?.sender || m.sender;
    const checkingOther = target !== m.sender;

    if (checkingOther && mentions.length === 0 && !m.quoted) {
      return await m.reply.info(
        `Usage: \`${p}vibe @person\` — or send \`${p}vibe\` alone to check yourself.`,
        'NEXORA • Vibe Check'
      );
    }

    await withReactionStatus(m, async () => {
      const seed = stableHash(target);
      const pct = seed % 101;
      const color = COLORS[seed % COLORS.length];
      const trait = TRAITS[(seed >>> 5) % TRAITS.length];
      const bar = meter(pct);

      const who = checkingOther
        ? `@${target.split('@')[0].split(':')[0]}`
        : 'You';

      const text =
        `✦ *VIBE CHECK* ✦\n\n` +
        `👤 ${who}\n\n` +
        `${color.emoji} Aura color: *${color.name}*\n` +
        `_(${color.note})_\n\n` +
        `${bar}\n` +
        `💠 Aura level: *${pct}%*\n\n` +
        `📈 Strongest trait: *${trait}*\n\n` +
        `${verdict(pct)}`;

      await actionCard(sock, m.from, { text, footer: 'NEXORA • Vibe Check 💠' },
        [{ kind: 'action', label: '💠 Check Someone Else', cmd: `${p}vibe` }],
        { quoted: m, mentions: checkingOther ? [target] : [] });

      await m.react(pct >= 60 ? '💠' : '📉');
    });
  }
};
