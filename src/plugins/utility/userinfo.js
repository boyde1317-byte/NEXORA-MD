import { withReactionStatus, replyTable } from '../../lib/cosmetics.js';

export default {
  name: 'userinfo',
  aliases: ['info', 'profile'],
  category: 'utility',
  description: 'Looks up a WhatsApp user\'s info — reply to their message, @ mention, or provide a number.',
  cooldown: 5000,
  execute: async ({ m, sock, args, db }) => {
    let targetJid = null;
    if (m.quoted) {
      targetJid = m.quoted.sender;
    } else if (m.msg?.contextInfo?.mentionedJid?.length) {
      targetJid = m.msg.contextInfo.mentionedJid[0];
    } else if (args[0]) {
      const num = args[0].replace(/[^0-9]/g, '');
      if (num.length >= 7) targetJid = `${num}@s.whatsapp.net`;
    } else if (!m.isGroup) {
      targetJid = m.sender;
    }

    if (!targetJid) {
      return await m.reply.info(
        'Usage: Reply to a message, mention someone with @, or provide a phone number.\n\n`!userinfo @user`\n`!userinfo 2335970000000`',
        'USER INFO'
      );
    }

    const number = targetJid.split('@')[0].split(':')[0];
    await withReactionStatus(m, async () => {
      const [onWA] = await sock.onWhatsApp(number).catch(() => [null]);
      if (!onWA?.exists) {
        throw new Error(`Number *+${number}* is not registered on WhatsApp.`);
      }

      let ppUrl = 'No profile picture';
      try {
        ppUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch (_) {}

      let statusText = 'N/A';
      try {
        const status = await sock.fetchStatus(targetJid);
        if (status?.status) statusText = status.status;
      } catch (_) {}

      const userData = db.getUser(targetJid);
      
      const rows = [
        ['Number',    `+${number}`],
        ['JID',       targetJid],
        ['Status',    statusText.length > 50 ? statusText.slice(0, 47) + '...' : statusText],
        ['Banned',    userData.banned ? '🚫 Yes' : '✅ No'],
        ['Premium',   userData.premium ? '💎 Yes' : '❌ No'],
        ['Warnings',  String(userData.warnings ?? 0)],
      ];

      await replyTable(m, sock, {
        caption: `👤 USER INFO — +${number}`,
        rows,
        footer: ppUrl !== 'No profile picture' ? `🖼️ Profile pic: ${ppUrl}` : undefined,
      });
    });
  }
};
