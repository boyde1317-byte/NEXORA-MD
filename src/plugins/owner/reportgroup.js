/**
 * reportgroup.js — Report a group to WhatsApp, then leave it.
 * Owner-only. Requires the literal word `confirm`: a successful report
 * makes the bot LEAVE the group, exactly like the official client.
 * Target: the current group, or an explicit group JID argument.
 */
import { normalizeJidInput, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportgroup',
  aliases: ['groupreport'],
  category: 'owner',
  description: 'Report a group (bot leaves it on success). Usage: .reportgroup [group JID] confirm',
  cooldown: 30000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid, isGroup }) => {
    if (!hasSocketMethod(sock, 'reportGroup')) {
      return await m.reply.error('This socket does not expose reportGroup — the bot needs baileys 0.3.18-r22 or newer.');
    }
    if (!args.map(a => String(a).toLowerCase()).includes('confirm')) {
      return await m.reply.error('Reporting a group makes the bot LEAVE it once WhatsApp accepts the report.\n\nTo proceed, run `.reportgroup confirm` inside the group, or `.reportgroup <group JID> confirm`');
    }
    const explicit = args.map(normalizeJidInput).find(j => j?.endsWith('@g.us'));
    const target = explicit || (isGroup ? jid : null);
    if (!target) {
      return await m.reply.error('No group to report: run this inside a group, or pass a group JID. Usage: `.reportgroup <group JID> confirm`');
    }
    try {
      const result = await sock.reportGroup(target);
      if (result?.success) {
        return await m.reply(`✅ Group report sent for ${target} — the bot has left the group.${result.reportId ? `\n▸ Report ID: ${result.reportId}` : ''}`);
      }
      return await m.reply.error(`Group report was not accepted${result?.error ? `: ${result.error}` : ''} — the bot is still in the group.`);
    } catch (err) {
      console.error('[reportgroup]', err?.message || err);
      return await m.reply.error(`Group report failed: ${err?.message || err}`);
    }
  },
};
