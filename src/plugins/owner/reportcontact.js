/**
 * reportcontact.js — Report a contact to WhatsApp.
 * Owner-only. Needs a phone-number or LID JID: mention, quoted sender,
 * or a number/JID argument. Unlike .reportspam it needs no captured
 * reporting tags.
 */
import { resolveTargetJid, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportcontact',
  aliases: ['contactreport'],
  category: 'owner',
  description: 'Report a contact. Usage: .reportcontact @user | .reportcontact <number>',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args }) => {
    if (!hasSocketMethod(sock, 'reportContact')) {
      return await m.reply.error('This socket does not expose reportContact — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const target = resolveTargetJid(m, args);
    if (!target) {
      return await m.reply.error('Usage: `.reportcontact @user` — or reply to their message with `.reportcontact`, or pass a number.');
    }
    try {
      const result = await sock.reportContact(target);
      if (result?.success) {
        return await m.reply(`✅ Contact report sent for ${target}${result.reportId ? `\n▸ Report ID: ${result.reportId}` : ''}`);
      }
      return await m.reply.error(`Contact report was not accepted${result?.error ? `: ${result.error}` : '.'}`);
    } catch (err) {
      console.error('[reportcontact]', err?.message || err);
      return await m.reply.error(`Contact report failed: ${err?.message || err}`);
    }
  },
};
