export default {
  name: 'promote',
  aliases: ['admin', 'pm'],
  category: 'group',
  description: 'Promotes a group participant to Group Admin.',
  permissions: {
    groupOnly: true,
    admin: true,
    botAdmin: true
  },
  execute: async ({ sock, m, args }) => {
    let target = '';

    if (m.quoted) {
      target = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid && m.msg.contextInfo.mentionedJid.length > 0) {
      target = m.msg.contextInfo.mentionedJid[0];
    } else if (args[0]) {
      const cleanNum = args[0].replace(/[^0-9]/g, '');
      if (cleanNum) {
        target = `${cleanNum}@s.whatsapp.net`;
      }
    }

    if (!target) {
      return await m.reply('❌ Please reply to a message, @mention a user, or supply their number to promote.');
    }

    try {
      await sock.groupParticipantsUpdate(m.from, [target], 'promote');
      await m.reply(`✅ *@${target.split('@')[0]}* has been successfully promoted to Admin!`, {
        mentions: [target]
      });
    } catch (err) {
      await m.reply(`❌ Failed to promote user: ${err.message}`);
    }
  }
};
