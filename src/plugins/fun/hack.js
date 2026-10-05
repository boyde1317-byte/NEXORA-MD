/**
 * hack.js — playful fake-hacking simulation.
 *
 * 100% for laughs: a staged terminal takeover rendered by editing the
 * same message in place (the Baileys fork supports `edit`), ending with
 * a gag "files found" list. No real network activity beyond the message
 * edits themselves. The footer of the final message says it plainly:
 * this is a joke and nothing was actually accessed.
 */
import { actionCard } from '../../lib/interactiveKit.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STAGES = [
  { emoji: '⚡', label: 'Establishing connection', pct: 12, bar: 1 },
  { emoji: '📶', label: 'Pinging device', pct: 31, bar: 3 },
  { emoji: '🔓', label: 'Bypassing firewall', pct: 54, bar: 5 },
  { emoji: '📂', label: 'Downloading chats', pct: 76, bar: 7 },
  { emoji: '📸', label: 'Fetching gallery', pct: 92, bar: 9 },
];

const FOUND = [
  { icon: '🗃️', name: 'reels_saved_but_never_sent', size: '2.4 GB' },
  { icon: '🎤', name: 'cringe_voice_notes_3AM.zip', size: '412 MB' },
  { icon: '📝', name: 'typed_then_deleted_texts.txt', size: '88 KB' },
  { icon: '👀', name: 'stalking_history_CHAPTER_ONE', size: '96 GB' },
  { icon: '🧦', name: 'profile_pics_from_2021', size: '1.1 GB' },
  { icon: '🛒', name: 'cart_abandoned_x47.txt', size: '12 KB' },
  { icon: '💔', name: 'drafts_to_the_ex', size: 'DO NOT OPEN' },
];

function bar(filled, len = 10) {
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

export default {
  name: 'hack',
  aliases: ['fakehack', 'intrusion'],
  category: 'fun',
  description: 'Runs a totally real (totally fake) hacking simulation on a target. 100% jokes, nothing is accessed.',
  cooldown: 8000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const mentions = m.msg?.contextInfo?.mentionedJid ?? [];
    let target = mentions[0] || m.quoted?.sender || null;

    if (!target) {
      return await m.reply.info(
        `Mention or reply to someone to "hack" them.\n\nUsage: \`${p}hack @victim\``,
        'NEXORA • Hack Sim'
      );
    }

    const tag = `@${target.split('@')[0].split(':')[0]}`;
    const targets = [target];

    // ── Stage the animation by editing one message in place ────────────
    let key;
    try {
      const sent = await sock.sendMessage(m.from, {
        text: '⌛ *NEXORA-INTRUSION v4.2* booting…',
        mentions: targets,
      }, { quoted: m });
      key = sent?.key;
    } catch (_) {
      key = null;
    }

    for (const s of STAGES) {
      const frame =
        `🛡️ *NEXORA-INTRUSION v4.2*\n` +
        `🎯 Target: ${tag}\n\n` +
        `${s.emoji} ${s.label}…\n` +
        `\`${bar(s.bar)}\` *${s.pct}%*\n\n` +
        '_Do not touch your phone._';
      try {
        if (key) {
          await sock.sendMessage(m.from, { text: frame, edit: key, mentions: targets });
        } else {
          await sock.sendMessage(m.from, { text: frame, mentions: targets });
        }
      } catch (_) {
        // Edit rejected (old message, etc.) — keep animating silently.
      }
      await sleep(1400);
    }

    // ── Final gag report ──────────────────────────────────────────────
    const picked = [...FOUND].sort(() => Math.random() - 0.5).slice(0, 3);
    const files = picked
      .map((f, i) => `${i + 1}. ${f.icon} \`${f.name}\` — ${f.size}`)
      .join('\n');
    const pct = 100;

    const text =
      `🛡️ *HACK COMPLETE* — ${pct}%\n\n` +
      `🎯 Target: ${tag}\n\n` +
      `📂 *Files recovered:*\n${files}\n\n` +
      `✅ *Access granted.* Password was "1234". Password was ALWAYS "1234".\n\n` +
      `_⚠️ This is a joke — a simulation. Nothing was accessed, downloaded or stored. Pure entertainment._`;

    try {
      if (key) {
        await sock.sendMessage(m.from, { text, edit: key, mentions: targets });
      } else {
        await actionCard(sock, m.from, { text, footer: 'NEXORA • Hack Sim 🎭' },
          [{ kind: 'action', label: '🎯 Hack Someone Else', cmd: `${p}hack` }],
          { quoted: m, mentions: targets });
      }
      await m.react('😈');
    } catch (_) {
      await actionCard(sock, m.from, { text, footer: 'NEXORA • Hack Sim 🎭' },
        [{ kind: 'action', label: '🎯 Hack Someone Else', cmd: `${p}hack` }],
        { quoted: m, mentions: targets });
    }
  }
};
