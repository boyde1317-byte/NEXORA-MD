/**
 * pptag.js — .pptag / .ppprivate — send every group member their own
 * profile picture, addressed privately where possible.
 *
 * Ported from LUNA MD plugins/pptag.js.
 *
 * NOTE: mass-DMing every group member can trigger WhatsApp spam/ban limits — use sparingly.
 *
 * Differences from the original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; `baileys` default import
 *     -> named `prepareWAMessageMedia` import (house style).
 *   - Group/admin gating moved from `handler.group = true` /
 *     `handler.admin = true` to the NexoraFlex contract
 *     `permissions: { groupOnly: true, admin: true }` (dispatcher
 *     enforced). No botAdmin requirement was in the original and none
 *     was added.
 *   - The closing note was rewritten: the original claimed private
 *     tagging was impossible because of "elaina-baileys (which is dead)"
 *     and told the reader to switch the baileys dependency to zapo-js.
 *     NexoraFlex runs its own baileys fork, so that advice is wrong
 *     here — the note now just says private delivery is best-effort and
 *     falls back to a normal group message.
 *   - The fallback profile-picture URL (cloud.yardansh.com) is kept as-is
 *     — it is only used when WhatsApp cannot return a member's picture.
 */
import { prepareWAMessageMedia } from 'baileys';

const FALLBACK_PP = 'https://cloud.yardansh.com/4aDFXw.jpg';

export default {
  name: 'pptag',
  aliases: ['ppprivate'],
  category: 'owner',
  description: 'Send each group member their own profile picture (owner + group admin only).',
  permissions: { groupOnly: true, admin: true },
  cooldown: 10000,
  execute: async ({ m, sock }) => {
    if (!m.isGroup) return await m.reply('❌ Group only');

    const jid = m.from;
    const groupMeta = await sock.groupMetadata(jid);
    const botNum = sock.user.id.split('@')[0].split(':')[0];
    const members = groupMeta.participants.filter((p) => p.id.split('@')[0].split(':')[0] !== botNum);

    await sock.sendMessage(jid, { text: `⏳ Trying to send ${members.length} privately...` }, { quoted: m });

    let done = 0;

    for (const p of members) {
      let pp;
      try { pp = await sock.profilePictureUrl(p.id, 'image'); }
      catch { pp = FALLBACK_PP; }

      try {
        // TRY PRIVATE FIRST
        const { imageMessage } = await prepareWAMessageMedia(
          { image: { url: pp } },
          { upload: sock.waUploadToServer }
        );

        const content = {
          imageMessage: {
            ...imageMessage,
            caption: `Hello @${p.id.split('@')[0]} - this is your profile picture\n> _private_`,
            contextInfo: { mentionedJid: [p.id] },
          },
        };

        const waMsg = await sock.generateWAMessageFromContent(jid, content, { userJid: sock.user.id });

        try {
          await sock.relayMessage(jid, waMsg.message, {
            messageId: waMsg.key.id,
            additionalNodes: [{ tag: 'to', attrs: { jid: p.id } }],
          });
          done++;
        } catch (e1) {
          // IF PRIVATE FAILS - SEND NORMALLY (SO IT IS NOT 0/5)
          console.log('private failed, normal fallback:', e1.message);
          await sock.sendMessage(jid, {
            image: { url: pp },
            caption: `Profile pic @${p.id.split('@')[0]}\n> _only you_`,
            mentions: [p.id],
          });
          done++;
        }
      } catch (e) {
        console.log('total error', e);
        try {
          await sock.sendMessage(jid, {
            image: { url: pp },
            caption: `Photo of @${p.id.split('@')[0]}`,
            mentions: [p.id],
          });
          done++;
        } catch {}
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    await m.reply(`✅ Done ${done}/${members.length}\n\nNOTE: private delivery is best-effort — where it fails, the picture is sent as a normal group message (everyone sees it).`);
  },
};
