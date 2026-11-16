/**
 * reportuser.js — Report a user to WhatsApp with a reason.
 * Owner-only. Target: mention, quoted sender, or a number/JID argument.
 * Reason: spam (default), harassment, impersonation, scam, other.
 * A "no ack" result usually means the request was sent but WhatsApp did
 * not confirm in time — the reply says so instead of claiming failure.
 */
import { resolveTargetJid, parseReportReason, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportuser',
  aliases: ['userreport'],
  category: 'owner',
  description: 'Report a user. Usage: .reportuser @user [spam|harassment|impersonation|scam|other]',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args }) => {
    if (!hasSocketMethod(sock, 'reportUser')) {
      return await m.reply.error('This socket does not expose reportUser — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const target = resolveTargetJid(m, args);
    if (!target) {
      return await m.reply.error('Usage: `.reportuser @user [reason]` — or reply to their message with `.reportuser [reason]`');
    }
    const reason = parseReportReason(args);
    try {
      const acked = await sock.reportUser(target, reason);
      if (acked) {
        return await m.reply(`✅ User report sent for ${target} (reason: ${reason}, confirmed by WhatsApp).`);
      }
      return await m.reply(`⚠️ User report for ${target} (reason: ${reason}) was sent, but WhatsApp did not confirm in time — it likely still went through.`);
    } catch (err) {
      console.error('[reportuser]', err?.message || err);
      return await m.reply.error(`User report failed: ${err?.message || err}`);
    }
  },
};
