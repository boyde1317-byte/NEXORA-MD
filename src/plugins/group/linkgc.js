/**
 * linkgc.js — .linkgc — show the current group invite link.
 *
 * Ported from luna-md/plugins/group-link-revoke.js, linkgc branch ONLY.
 * The revoke branch stays with NexoraFlex's own group/revoke.js
 * (.revoke / .resetlink), so it is not duplicated here.
 */

export default {
  name: 'linkgc',
  aliases: [],
  category: 'group',
  description: 'Show the current group invite link.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    try {
      const code = await sock.groupInviteCode(m.from);
      await m.reply(`https://chat.whatsapp.com/${code}`);
    } catch (err) {
      await m.reply.error(`Failed to get the group link: ${err.message}`);
    }
  },
};
