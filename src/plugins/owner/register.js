/**
 * register.js — Complete phone-number registration with a received code.
 * Owner-only. Requires confirmation: on success baileys overwrites the
 * session identity (creds.me) with the registered number and marks the
 * session registered, which replaces what this running bot is signed in
 * as. The confirm step renders as an action card with a one-tap button
 * (the typed command still works, for clients without buttons). The
 * result renders through AIRich, falling back to a rich table. Only run
 * it after `.regcode`, for a number you control, when you intend the
 * bot to become that account.
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { sendSocketResult } from '../../lib/socketCards.js';
import { hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'register',
  aliases: ['regcomplete'],
  category: 'owner',
  description: 'Complete registration with a code. Usage: .register <code> confirm',
  cooldown: 60000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid, prefix }) => {
    if (!hasSocketMethod(sock, 'register')) {
      return await m.reply.error('This socket does not expose register — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const code = String(args[0] || '').replace(/[^0-9-]/g, '');
    const p = prefix || '.';
    if (!code) {
      return await m.reply.error('Usage: `.register <code> confirm`\n\nRun `.regcode` first, for a number you control — this replaces the bot\'s session identity.');
    }
    if (!args.map(a => String(a).toLowerCase()).includes('confirm')) {
      const confirmCmd = `${p}register ${code} confirm`;
      return await actionCard(sock, jid, {
        text: `⚠️ This replaces the bot's session identity with the registered number.\n\nOnly proceed after \`.regcode\`, for a number you control.\n\nTap to confirm, or run \`${confirmCmd}\``,
        footer: 'NEXORA • Confirm required',
      }, [
        { label: '⚠️ Yes, register', cmd: confirmCmd },
      ], { quoted: m });
    }
    try {
      const result = await sock.register(code);
      return await sendSocketResult(sock, jid, m, {
        title: '✅ REGISTRATION COMPLETE',
        rows: [
          ['Login', result?.login || 'unknown'],
          ['Status', result?.status || 'unknown'],
        ],
        tips: ['Expect the bot to reconnect as the new account'],
      });
    } catch (err) {
      console.error('[register]', err?.message || err);
      const detail = err?.reason || err?.message || err;
      return await m.reply.error(`Registration failed: ${detail}`);
    }
  },
};
