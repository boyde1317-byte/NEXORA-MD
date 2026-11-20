/**
 * hidetag2.js — .hidetag2 <text> — mention every group member silently.
 *
 * Ported from luna-md/plugins/group-hidetag.js. Named hidetag2 because
 * NexoraFlex already ships .hidetag (group/hidetag.js). Same shape as
 * the house hidetag: participants come from sock.groupMetadata, the
 * message text goes out with the mentions array attached and no @names
 * shown. Group + admin only.
 */

export default {
  name: 'hidetag2',
  aliases: [],
  category: 'group',
  description: 'Mention all group members silently with a message. Usage: .hidetag2 <text>',
  permissions: { groupOnly: true, admin: true },
  cooldown: 8000,
  execute: async ({ m, sock, args }) => {
    const meta = await sock.groupMetadata(m.from);
    if (!meta) return await m.reply.error('Could not retrieve group members.');
    const mentions = meta.participants.map((p) => p.id).filter(Boolean);
    const text = args.join(' ').trim() || '📢';
    await sock.sendMessage(m.from, { text, mentions }, { quoted: m });
  },
};
