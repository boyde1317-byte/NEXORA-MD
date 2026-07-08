import { buildTextMenu } from '../formatter.js';
import { newsletterManager } from '../../newsletter/newsletterManager.js';
import brand from '../../../config/brand.js';

export const newsletterMenu = {
  id: 7,
  name: 'newsletter',
  description: 'WhatsApp Channel/Newsletter official announcement style feed',
  supportedMessages: ['newsletterAdminInviteMessage', 'newsletterFollowerInviteMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const textContent = buildTextMenu(menuData);

    return await newsletterManager.sendNewsletterInvite(sock, m.from, {
      name: `${brand.name} Updates`,
      caption: `⚡ *NEXORA BROADCAST ENGINE*\n\n` +
               `🟢 _Verified Partner • 12.8K Followers_\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
               `🛎️ *TODAY'S SYSTEM BRIEF*\n` +
               `• *Status:* 🟢 Optimal Performance\n` +
               `• *Core Engine:* Baileys Multi-Device Native Fork\n` +
               `• *Current Uptime:* \`${menuData.uptime}\`\n` +
               `• *Loaded Modules:* ${menuData.totalCommands} Plugins\n\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
               textContent +
               `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
               `🔕 _You are receiving this message because you are subscribed to our bot core updates._`,
      forwardingEnabled: true
    }, { quoted: m });
  }
};

export default newsletterMenu;
