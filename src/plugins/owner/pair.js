/**
 * pair.js — link another WhatsApp number as an extra bot session.
 *
 * .pair <number>  → opens a pairing channel; the pairing code arrives as a
 *                   follow-up message the moment WhatsApp accepts the request.
 * .pair list      → same as .sessions
 *
 * Owner-only. Once the code is entered on the other phone (Linked Devices →
 * Link with phone number instead), that number comes online as a full
 * second NEXORA instance via src/core/sessionManager.js.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { pairSession, MAX_EXTRA_SESSIONS } from '../../core/sessionManager.js';
import { listAndSend } from './sessions.js';

export default {
  name: 'pair',
  aliases: ['addsession', 'linksession'],
  category: 'owner',
  description: 'Link another WhatsApp number as an extra bot session. Usage: .pair <number with country code>',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'list' || sub === 'sessions') {
      return await listAndSend(sock, m, p);
    }
    if (!args.length) {
      return await m.reply.info(
        `*LINK ANOTHER WHATSAPP NUMBER*\n\n\`${p}pair <number with country code>\` — issues a pairing code. The other phone enters it in WhatsApp → Settings → Linked Devices → Link a Device → *Link with phone number instead*.\n\nThat number then comes online as a full second NEXORA instance (max ${MAX_EXTRA_SESSIONS}): its owner types commands in groups or their self-chat and gets full bot replies — including owner-only commands, since the paired number is the owner of its own session. Bot replies never leak into that owner's private chats with other people.\n\n\`${p}sessions\` — list linked sessions\n\`${p}delsession <number>\` — remove one`,
        'PAIR SESSION'
      );
    }

    const raw = args[0];

    // Tiered power: a paired session's owner cannot spawn MORE sessions
    // (lateral escalation); the super owner can pair from any session.
    if (sock._nexoraExtraSession && !(await m.isSuperOwner)) {
      console.warn(`[CMD-DENY] pair: paired-session owner tried to pair +${raw}`);
      return await m.reply.error(
        `*Not allowed.* Pairing new sessions is reserved for the super owner — use the main bot.`
      );
    }

    return await withReactionStatus(m, async () => {
      try {
        await pairSession(raw, { notifyJid: m.from });
        // The code itself arrives as a follow-up message from this bot the
        // moment WhatsApp accepts the pairing request — the WS handshake
        // takes a couple of seconds.
        return await m.reply(
          `🔌 *Opening a pairing channel for +${raw.replace(/[^\\d]/g, '')}…*\n\nThe pairing code will arrive here in a few seconds. It is valid for a couple of minutes — enter it on the other phone as soon as it appears.\n\nI'll confirm here once the number links.`
        );
      } catch (err) {
        return await m.reply.error(`*Pairing failed:* ${err.message || err}`);
      }
    });
  },
};
