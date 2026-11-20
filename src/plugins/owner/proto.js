/**
 * proto.js — owner-only raw quoted-message resender.
 *
 * Rem exposes this as .proto / .resend. It relays the quoted WhatsApp
 * message payload without reconstructing it as ordinary text, then confirms
 * the operation through the same AIRich envelope used by the other tools.
 */
import { generateMessageIDV2, generateWAMessageFromContent } from 'baileys';
import { AIRich } from '../../lib/NIXCODE.js';

function quotedContent(m) {
  return m.quoted?.message
    || m.quoted?.msg
    || m.msg?.contextInfo?.quotedMessage
    || null;
}

export default {
  name: 'proto',
  aliases: ['resend', 'dump'],
  category: 'owner',
  description: 'Resend the raw payload of a quoted message.',
  permissions: { owner: true },
  cooldown: 2500,
  execute: async ({ sock, m }) => {
    const content = quotedContent(m);
    if (!content || typeof content !== 'object' || !Object.keys(content).length) {
      return m.reply('Reply to a message first, then send .proto or .resend.');
    }

    const type = Object.keys(content)[0] || 'unknown';
    try {
      let relayed = false;
      if (typeof generateWAMessageFromContent === 'function') {
        const generated = generateWAMessageFromContent(m.from, content, {
          messageId: generateMessageIDV2(),
          userJid: sock.user?.id,
        });
        await sock.relayMessage(m.from, generated.message, { messageId: generated.key.id });
        relayed = true;
      } else {
        await sock.relayMessage(m.from, content, { messageId: generateMessageIDV2() });
        relayed = true;
      }

      if (!relayed) throw new Error('The raw relay did not produce a message.');
      try {
        await new AIRich(sock)
          .setTitle('NEXORA PROTO RESENDER')
          .addText(`## Raw message resent\n\nPayload type: **${type}**\n\nThe quoted message was relayed without converting it to plain text.`)
          .setFooter('Owner tool • raw payload relay')
          .send(m.from, { quoted: m });
      } catch (richError) {
        console.warn('[proto] confirmation card failed:', richError.message);
        await m.reply(`Raw message resent successfully.\nPayload type: ${type}`);
      }
    } catch (error) {
      console.error('[proto] relay failed:', error);
      try {
        await sock.relayMessage(m.from, content, { messageId: generateMessageIDV2() });
        return m.reply(`Raw fallback relay succeeded.\nPayload type: ${type}`);
      } catch (fallbackError) {
        return m.reply(`Raw relay failed: ${fallbackError.message || error.message}`);
      }
    }
  },
};
