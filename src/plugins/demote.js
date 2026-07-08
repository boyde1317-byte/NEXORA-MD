export default {
  name: 'demote',
  aliases: ['unadmin', 'dm'],
  category: 'group',
  description: 'Demotes a Group Admin back to a regular member.',
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
      return await m.reply('❌ Please reply to an admin\'s message, @mention them, or supply their number to demote.');
    }

    try {
      await sock.groupParticipantsUpdate(m.from, [target], 'demote');
      await m.reply(`✅ *@${target.split('@')[0]}* has been successfully demoted to standard member.`, {
        mentions: [target]
      });
    } catch (err) {
      await m.reply(`❌ Failed to demote user: ${err.message}`);
    }
  }
};
