/**
 * proto2.js — owner-only raw quoted-message resender (second variant).
 *
 *   .proto2   reply to any message to relay its raw payload back
 *
 * Ported from the LUNA MD proto.js plugin. NexoraFlex already ships
 * .proto (src/plugins/owner/proto.js, aliases resend/dump), so this
 * variant is .proto2 and never shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/proto.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, owner gating via
 *     `permissions: { owner: true }`.
 *   - The LUNA file defined its own mini AIRich class inline; this uses
 *     the shared house builder from src/lib/NIXCODE.js instead.
 *   - `generateWAMessageFromContent` / `generateMessageIDV2` are imported
 *     from 'baileys' directly (the house proto.js proves both exist on
 *     the fork); the LUNA fallback chain that hunted for the function in
 *     several places is gone.
 *   - `conn.loadMessage` fallback is dropped — the NexoraFlex socket has
 *     no such method; the quoted payload comes from
 *     `m.quoted?.message || m.quoted?.msg` with the contextInfo fallback.
 *   - Branding 'LUNA PROTO SYSTEM' / 'Luna-Multidevice v2.0.0' ->
 *     'NEXORA MD'.
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
  name: 'proto2',
  aliases: [],
  category: 'owner',
  description: 'Resend the raw payload of a quoted message. Owner only.',
  permissions: { owner: true },
  cooldown: 2500,
  execute: async ({ sock, m }) => {
    if (!m.quoted) return m.reply('*⚠️ Reply to any message!*');

    try {
      const quotedMessage = quotedContent(m);
      if (!quotedMessage) throw new Error('Quoted message is empty');

      // METHOD 1: If generateWAMessageFromContent exists
      if (generateWAMessageFromContent) {
        const msg = generateWAMessageFromContent(m.from, quotedMessage, {
          messageId: generateMessageIDV2(),
          userJid: sock.user?.id,
        });
        await sock.relayMessage(m.from, msg.message, { messageId: msg.key.id });
      } else {
        // METHOD 2: Direct relay fallback
        await sock.relayMessage(m.from, quotedMessage, { messageId: generateMessageIDV2() });
      }

      // UI Nexora
      const render = new AIRich(sock)
        .setTitle('✨ ───〔 NEXORA PROTO SYSTEM 〕─── ✨')
        .setFooter('🎯 Bot: NEXORA MD')
        .addText('# 📦 Resend Successful!\n\nAny message was successfully resent by Nexora.');

      try {
        await render.send(m.from, { quoted: m });
      } catch (_) {
        await sock.sendMessage(m.from, {
          text: `✅ Resend successful by Nexora\nType: ${Object.keys(quotedMessage)[0]}`,
        }, { quoted: m });
      }

      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    } catch (e) {
      console.error('[proto2]', e);
      // Last, safest fallback
      try {
        const q = quotedContent(m);
        await sock.relayMessage(m.from, q, {});
        return;
      } catch {}
      m.reply(`*❌ Nexora failed:*\n\`${e.message}\``);
    }
  },
};
