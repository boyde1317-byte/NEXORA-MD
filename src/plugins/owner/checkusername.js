/**
 * checkusername.js — Check whether a WhatsApp @username is available.
 * Owner-only. Read-only: queries the username service, changes nothing.
 * Results render through AIRich (native table + a follow-up pill to set
 * an available name), falling back to a rich table card.
 */
import { sendSocketResult, sendUsernameTakenCard } from '../../lib/socketCards.js';
import { normalizeUsername, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'checkusername',
  aliases: ['usernamecheck'],
  category: 'owner',
  description: 'Check if a WhatsApp username is available. Usage: .checkusername <name>',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid, prefix }) => {
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
        const setCmd = `${prefix || '.'}setusername ${result.username}`;
        return await sendSocketResult(sock, jid, m, {
          title: '🔎 USERNAME CHECK',
          rows: [
            ['Username', `@${result.username}`],
            ['Status', '✅ Available'],
          ],
          suggest: [setCmd],
          buttons: [{ kind: 'action', label: '✏️ Set this username', cmd: setCmd }],
        });
      }
      return await sendUsernameTakenCard(sock, jid, m, prefix, username, result, 'checkusername');
    } catch (err) {
      console.error('[checkusername]', err?.message || err);
      return await m.reply.error(`Username check failed: ${err?.message || err}`);
    }
  },
};
