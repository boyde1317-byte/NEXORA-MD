/**
 * reportspam.js — Report a chat for spam with its captured reporting tags.
 * Owner-only. reportSpam() needs reporting_tag metadata captured from
 * messages received since boot; without any it fails, and the reply says
 * so plainly. Target: mention, quoted sender, number/JID argument, or the
 * current chat. Optional count (1-5) limits how many messages are sent.
 */
import { resolveTargetJid, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportspam',
  aliases: ['spamreport'],
  category: 'owner',
  description: 'Report a chat for spam. Usage: .reportspam [@user|number] [count 1-5]',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid }) => {
    if (!hasSocketMethod(sock, 'reportSpam')) {
      return await m.reply.error('This socket does not expose reportSpam — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const target = resolveTargetJid(m, args) || jid;
    const countArg = args.find(a => /^\d+$/.test(a) && Number(a) >= 1 && Number(a) <= 5);
    const maxMessages = countArg ? Number(countArg) : 5;
    try {
      const result = await sock.reportSpam(target, { maxMessages });
      if (result?.success) {
        return await m.reply(`✅ Spam report sent for ${target}${result.reportId ? `\n▸ Report ID: ${result.reportId}` : ''}${result.messageCount ? `\n▸ Messages included: ${result.messageCount}` : ''}`);
      }
      return await m.reply.error(`Spam report was not accepted${result?.error ? `: ${result.error}` : '.'}`);
    } catch (err) {
      console.error('[reportspam]', err?.message || err);
      if (String(err?.message || '').includes('no reporting_tag')) {
        return await m.reply.error('No reporting data captured for this chat yet. The bot must receive a message from them after boot before a tag-based spam report can be sent. Try `.reportuser` instead — it needs no captured messages.');
      }
      return await m.reply.error(`Spam report failed: ${err?.message || err}`);
    }
  },
};
