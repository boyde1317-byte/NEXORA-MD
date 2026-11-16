/**
 * checkusername.js — Check whether a WhatsApp @username is available.
 * Owner-only. Read-only: queries the username service, changes nothing.
 */
import { normalizeUsername, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'checkusername',
  aliases: ['usernamecheck'],
  category: 'owner',
  description: 'Check if a WhatsApp username is available. Usage: .checkusername <name>',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ sock, m, args }) => {
    if (!hasSocketMethod(sock, 'checkUsername')) {
      return await m.reply.error('This socket does not expose checkUsername — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const username = normalizeUsername(args[0]);
    if (!username || /\s/.test(username)) {
      return await m.reply.error('Usage: `.checkusername <name>` — one username, no spaces. Example: `.checkusername nexora`');
    }
    try {
      const result = await sock.checkUsername(username);
      if (result?.available) {
        return await m.reply(`✅ *@${result.username}* is available.\n\nSet it with \`.setusername ${result.username}\``);
      }
      const lines = [`❌ *@${username}* is not available.`];
      if (result?.rejectionReasons?.length) lines.push(`\nReason: ${result.rejectionReasons.join(', ')}`);
      if (result?.suggestions?.length) lines.push(`\nSuggestions:\n${result.suggestions.map(s => `• @${s}`).join('\n')}`);
      return await m.reply(lines.join('\n'));
    } catch (err) {
      console.error('[checkusername]', err?.message || err);
      return await m.reply.error(`Username check failed: ${err?.message || err}`);
    }
  },
};
