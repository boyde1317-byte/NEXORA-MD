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

    const inviteOptions = {
      name:    `${brand.name} Updates`,
      caption: `⚡ *NEXORA BROADCAST ENGINE*\n\n` +
               `🟢 _Verified Partner • Official Channel_\n` +
               `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
               `🛎️ *TODAY'S SYSTEM BRIEF*\n` +
               `• *Status:* 🟢 Optimal Performance\n` +
               `• *Core Engine:* Baileys Multi-Device Native Fork\n` +
               `• *Total Commands:* ${menuData.totalCommands}\n` +
               `• *System Uptime:* ${menuData.uptime}\n\n` +
               `${textContent}`,
      // Use the configured channel JID so owners can set their real channel
      newsletterJid:     menuData.channelJid || undefined,
      forwardingEnabled: true
    };

    // ── Tier 1: Newsletter admin invite card ──────────────────────────────
    // newsletterManager.sendNewsletterInvite already has its own internal
    // fallback to externalAdReply, so this is a two-level system.
    try {
      return await newsletterManager.sendNewsletterInvite(sock, m.from, inviteOptions, { quoted: m });
    } catch (err) {
      console.warn('[MENU newsletter] Tier 1 (newsletter invite) failed, escalating to text:', err.message);
      throw err;   // runWithFallback → plain text
    }
  }
};

export default newsletterMenu;
