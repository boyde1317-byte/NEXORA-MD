/**
 * reportgroup.js — Report a group to WhatsApp, then leave it.
 * Owner-only. Requires confirmation: a successful report makes the bot
 * LEAVE the group, exactly like the official client. The confirm step
 * renders as an action card with a one-tap button (the typed command
 * still works, for clients without buttons). The result renders through
 * AIRich, falling back to a rich table. Target: the current group, or
 * an explicit group JID argument.
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { sendSocketResult } from '../../lib/socketCards.js';
import { normalizeJidInput, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportgroup',
  aliases: ['groupreport'],
  category: 'owner',
  description: 'Report a group (bot leaves it on success). Usage: .reportgroup [group JID] confirm',
  cooldown: 30000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid, isGroup, prefix }) => {
    if (!hasSocketMethod(sock, 'reportGroup')) {
      return await m.reply.error('This socket does not expose reportGroup — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const p = prefix || '.';
    const explicit = args.map(normalizeJidInput).find(j => j?.endsWith('@g.us'));
    const target = explicit || (isGroup ? jid : null);
    if (!target) {
      return await m.reply.error('No group to report: run this inside a group, or pass a group JID. Usage: `.reportgroup <group JID> confirm`');
    }
    if (!args.map(a => String(a).toLowerCase()).includes('confirm')) {
      const confirmCmd = explicit ? `${p}reportgroup ${target} confirm` : `${p}reportgroup confirm`;
      return await actionCard(sock, jid, {
        text: `⚠️ Reporting this group makes the bot LEAVE it once WhatsApp accepts the report.\n\nGroup: ${target}\n\nTap to confirm, or run \`${confirmCmd}\``,
        footer: 'NEXORA • Confirm required',
      }, [
        { label: '⚠️ Yes, report & leave', cmd: confirmCmd },
      ], { quoted: m });
    }
    try {
      const result = await sock.reportGroup(target);
      if (result?.success) {
        const rows = [
          ['Group', target],
          ['Status', '✅ Report accepted — bot left the group'],
        ];
        if (result.reportId) rows.push(['Report ID', result.reportId]);
        return await sendSocketResult(sock, jid, m, { title: '🚨 GROUP REPORT', rows });
      }
      return await m.reply.error(`Group report was not accepted${result?.error ? `: ${result.error}` : ''} — the bot is still in the group.`);
    } catch (err) {
      console.error('[reportgroup]', err?.message || err);
      return await m.reply.error(`Group report failed: ${err?.message || err}`);
    }
  },
};
