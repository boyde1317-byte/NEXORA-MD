import newsletterManager from '../newsletter/newsletterManager.js';

export default {
  name: 'setchannel',
  aliases: ['setch', 'setdefaultchannel'],
  category: 'owner',
  description: 'Sets the default official WhatsApp broadcast channel JID for the framework.',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ sock, m, args, prefix }) => {
    const targetJid = args[0];
    
    if (!targetJid) {
      return await m.reply(
        `⚠️ *Usage:* \`${prefix}setchannel <newsletter-jid>\`\n\n` +
        `_Example:_ \`${prefix}setchannel 120363200000000000@newsletter\``
      );
    }

    if (!targetJid.endsWith('@newsletter')) {
      return await m.reply(`❌ *Invalid JID format!* WhatsApp channel JIDs must end with \`@newsletter\`.`);
    }

    try {
      newsletterManager.setDefaultChannel(targetJid);
      
      let successMsg = `✅ *Official Channel Updated Successfully!*\n\n`;
      successMsg += `• *New Default JID:* \`${targetJid}\`\n\n`;
      successMsg += `All future interactive menus, default newsletter invites, and footer links will now point to this channel.`;
      
      await m.reply(successMsg);
    } catch (err) {
      console.error('[SETCHANNEL] Error saving setting:', err);
      await m.reply(`❌ Failed to update default channel: ${err.message || err}`);
    }
  }
};
