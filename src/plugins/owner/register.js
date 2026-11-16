/**
 * register.js — Complete phone-number registration with a received code.
 * Owner-only. Requires the literal word `confirm`: on success baileys
 * overwrites the session identity (creds.me) with the registered number
 * and marks the session registered, which replaces what this running
 * bot is signed in as. Only run it after `.regcode`, for a number you
 * control, when you intend the bot to become that account.
 */
import { hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'register',
  aliases: ['regcomplete'],
  category: 'owner',
  description: 'Complete registration with a code. Usage: .register <code> confirm',
  cooldown: 60000,
  permissions: { owner: true },
  execute: async ({ sock, m, args }) => {
    if (!hasSocketMethod(sock, 'register')) {
      return await m.reply.error('This socket does not expose register — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const code = String(args[0] || '').replace(/[^0-9-]/g, '');
    if (!code || !args.map(a => String(a).toLowerCase()).includes('confirm')) {
      return await m.reply.error('⚠️ This replaces the bot\'s session identity with the registered number.\n\nOnly proceed after `.regcode`, for a number you control. Usage: `.register <code> confirm`');
    }
    try {
      const result = await sock.register(code);
      return await m.reply(`✅ Registration complete.\n▸ Login: ${result?.login || 'unknown'}\n▸ Status: ${result?.status || 'unknown'}\n\nThe session identity is now that number. Expect the bot to reconnect as the new account.`);
    } catch (err) {
      console.error('[register]', err?.message || err);
      const detail = err?.reason || err?.message || err;
      return await m.reply.error(`Registration failed: ${detail}`);
    }
  },
};
