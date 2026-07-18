export default {
  name: 'unmute',
  aliases: ['opengroup'],
  category: 'group',
  description: 'Unmutes the group so all participants can send messages.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock }) => {
    try {
      await sock.groupSettingUpdate(m.from, 'not_announcement');
      await m.reply.success('Group unmuted. All participants can send messages now.');
    } catch (err) {
      await m.reply.error(`Failed to unmute group: ${err.message}`);
    }
  }
};
