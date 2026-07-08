export default {
  name: 'kick',
  aliases: ['remove', 'k'],
  category: 'group',
  description: 'Removes a participant from the group.',
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
      return await m.reply('❌ Please reply to a member\'s message, mention them using @, or provide their phone number.');
    }

    const targetNumber = target.split('@')[0];
    
    // Prevent kicking the bot itself or the owner
    if (target === sock.user.id.split(':')[0] + '@s.whatsapp.net') {
      return await m.reply('❌ Nice try, but I won\'t kick myself.');
    }

    try {
      await sock.groupParticipantsUpdate(m.from, [target], 'remove');
      await m.reply(`✅ Successfully removed *@${targetNumber}* from the group.`, {
        mentions: [target]
      });
    } catch (err) {
      await m.reply(`❌ Failed to remove user: ${err.message}`);
    }
  }
};
