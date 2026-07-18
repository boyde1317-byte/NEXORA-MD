export default {
  name: 'mute',
  aliases: ['closegroup'],
  category: 'group',
  description: 'Mutes the group so only admins can send messages.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    try {
      await sock.groupSettingUpdate(m.from, 'announcement');
      await m.reply.success('Group muted. Only admins can send messages now.');
    } catch (err) {
      await m.reply.error(`Failed to mute group: ${err.message}`);
    }
  }
};
