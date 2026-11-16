/**
 * reportmessage.js — Report one specific message to WhatsApp.
 * Owner-only. Must reply to the message being reported: its stanza ID
 * and author come from the quote. Reason: spam (default), harassment,
 * impersonation, scam, other. Results render through AIRich, falling
 * back to a rich table.
 */
import { sendSocketResult } from '../../lib/socketCards.js';
import { parseReportReason, hasSocketMethod } from '../../lib/socketTargets.js';

export default {
  name: 'reportmessage',
  aliases: ['reportmsg', 'msgreport'],
  category: 'owner',
  description: 'Report the message you reply to. Usage: reply with .reportmessage [spam|harassment|impersonation|scam|other]',
  cooldown: 10000,
  permissions: { owner: true },
  execute: async ({ sock, m, args, jid }) => {
    if (!hasSocketMethod(sock, 'reportMessage')) {
      return await m.reply.error('This socket does not expose reportMessage — the bot needs baileys 0.3.18-r22 or newer.');
    }
    const messageId = m?.quoted?.key?.id;
    if (!messageId) {
      return await m.reply.error('Reply to the message you want to report, then run `.reportmessage [reason]`');
    }
    const reason = parseReportReason(args);
    const participant = m.quoted.key.participant || m.quoted.sender || undefined;
    try {
      const acked = await sock.reportMessage(jid, messageId, reason, participant);
      return await sendSocketResult(sock, jid, m, {
        title: '🚨 MESSAGE REPORT',
        rows: [
          ['Message ID', messageId],
          ['Reason', reason],
          ['Status', acked ? '✅ Sent & confirmed' : '⚠️ Sent, no confirmation (likely went through)'],
        ],
      });
    } catch (err) {
      console.error('[reportmessage]', err?.message || err);
      return await m.reply.error(`Message report failed: ${err?.message || err}`);
    }
  },
};
