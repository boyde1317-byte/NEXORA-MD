export default {
  name: 'setdesc',
  category: 'group',
  description: 'Changes the group description.',
  permissions: { groupOnly: true, admin: true, botAdmin: true },
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const desc = args.join(' ');
    if (!desc) return await m.reply.info('Usage: `!setdesc <new description>`', 'GROUP MANAGEMENT');
    
    try {
      await sock.groupUpdateDescription(m.from, desc);
      await m.reply.success('Group description updated successfully.');
    } catch (err) {
      await m.reply.error(`Failed to update description: ${err.message}`);
    }
  }
};
