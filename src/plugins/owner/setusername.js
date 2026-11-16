/**
 * setusername.js — Set the bot account's WhatsApp @username.
 * Owner-only. Checks availability first and refuses taken names, so a
 * typo never overwrites the current username with a failed set. A taken
 * name renders the shared AIRich result table; success is a short AIRich
 * reply with a plain fallback.
 */
import { sendSocketResult, sendUsernameTakenCard } from '../../lib/socketCards.js';
import { normalizeUsername, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'setusername',
  aliases: ['setuser'],
  category: 'owner',
  description: 'Set the bot\'s WhatsApp username. Usage: .setusername <name>',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid, prefix }) => {
    if (!hasSocketMethod(sock, 'checkUsername') || !hasSocketMethod(sock, 'setUsername')) {
      return await m.reply.error('This socket does not expose the username methods — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const username = normalizeUsername(args[0]);
    if (!username || /\s/.test(username)) {
      return await m.reply.error('Usage: `.setusername <name>` — one username, no spaces. Example: `.setusername nexora`');
    }
    try {
      const check = await sock.checkUsername(username);
      if (!check?.available) {
        return await sendUsernameTakenCard(sock, jid, m, prefix, username, check, 'setusername');
      }
      await sock.setUsername(username);
      return await sendSocketResult(sock, jid, m, {
        title: '✅ USERNAME SET',
        text: `Bot username set to *@${username}*.`,
      });
    } catch (err) {
      console.error('[setusername]', err?.message || err);
      return await m.reply.error(`Setting the username failed: ${err?.message || err}`);
    }
  },
};
