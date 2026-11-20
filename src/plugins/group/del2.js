/**
 * del2.js — .del2 — delete a replied-to message for everyone.
 *
 * Ported from LUNA MD plugins/tools-delete.js (command del/delete).
 * Named del2 because NEXORA MD already ships .del (src/plugins/group/
 * del.js) — this is the separate LUNA variant of the same job.
 *
 * Differences from the LUNA original:
 *   - Group/admin gating via permissions: { groupOnly: true, admin: true,
 *     botAdmin: true } instead of the LUNA isAdmin/isBotAdmin + global
 *     dfail checks. The dispatcher enforces the gates.
 *   - Own-message delete uses m.quoted.key (fromMe + id), matching the
 *     house del.js shape; other-member delete reads participant + stanza
 *     id from m.quoted.key instead of digging into
 *     m.message.extendedTextMessage.contextInfo.
 *   - m.chat -> m.from; all strings English, branded NEXORA MD.
 */
export default {
  name: 'del2',
  aliases: [],
  category: 'group',
  description: 'Delete a message for everyone. Reply to it and send .del2',
  cooldown: 3000,
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  execute: async ({ sock, m, prefix }) => {
    const p = prefix || '.';
    if (!m.quoted) {
      return await m.reply(`Reply to the message you want to delete with the caption ${p}del2`);
    }

    const qKey = m.quoted.key || {};
    try {
      if (qKey.fromMe) {
        await sock.sendMessage(m.from, {
          delete: { remoteJid: m.from, fromMe: true, id: qKey.id },
        }, { quoted: m });
        return; // silent success — the deletion IS the confirmation
      }

      await sock.sendMessage(m.from, {
        delete: {
          remoteJid: m.from,
          fromMe: false,
          id: qKey.id,
          participant: qKey.participant,
        },
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Delete failed: ${err.message || 'message may be too old to delete for everyone'}`);
    }
  },
};
