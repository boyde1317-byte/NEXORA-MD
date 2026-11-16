/**
 * finduser.js — Resolve a WhatsApp @username to its JID.
 * Owner-only. Optional second argument is the username key (PIN) for
 * PIN-protected usernames. The result renders through AIRich (table plus
 * a code block carrying the JID), falling back to a rich table card
 * with a copy-JID button.
 */
import { sendSocketResult } from '../../lib/socketCards.js';
import { normalizeUsername, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'finduser',
  aliases: ['findbyusername', 'whoisusername'],
  category: 'owner',
  description: 'Find a user by WhatsApp username. Usage: .finduser <name> [pin]',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid }) => {
    if (!hasSocketMethod(sock, 'findUserByUsername')) {
      return await m.reply.error('This socket does not expose findUserByUsername — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const username = normalizeUsername(args[0]);
    if (!username || /\s/.test(username)) {
      return await m.reply.error('Usage: `.finduser <name> [pin]` — example: `.finduser nexora`');
    }
    try {
      const found = await sock.findUserByUsername(username, args[1]);
      if (!found?.jid) {
        return await m.reply(`No user found for *@${username}*.`);
      }
      return await sendSocketResult(sock, jid, m, {
        title: '👤 USERNAME LOOKUP',
        rows: [
          ['Username', `@${username}`],
          ['JID', found.jid],
          ['In contacts', found.contact ? 'Yes' : 'No'],
        ],
        code: found.jid,
        buttons: [{ kind: 'copy', label: '📋 Copy JID', value: found.jid }],
      });
    } catch (err) {
      console.error('[finduser]', err?.message || err);
      return await m.reply.error(`Username lookup failed: ${err?.message || err}`);
    }
  },
};
