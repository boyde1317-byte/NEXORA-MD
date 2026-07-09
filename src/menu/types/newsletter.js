import capabilities from '../../core/capabilities.js';
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
      const caption =
        `⚡ *NEXORA BROADCAST ENGINE*\n\n` +
        `🟢 _Verified Partner • Official Channel_\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🕮️ *TODAY'S SYSTEM BRIEF*\n` +
        `• *Status:* 🟢 Optimal Performance\n` +
        `• *Core Engine:* Baileys Multi-Device Native Fork\n` +
        `• *Total Commands:* ${menuData.totalCommands}\n` +
        `• *System Uptime:* ${menuData.uptime}\n\n` +
        textContent;

      // ── Tier 1: Newsletter admin invite card ──────────────────────────────────────────────────
      // Requires proto support AND a valid channelJid. Without both, the invite
      // either sends silently (no-op) or throws a misleading error.
      const hasProto   = capabilities.newsletter?.adminInviteMessage;
      const hasChannel = !!menuData.channelJid;

      if (hasProto && hasChannel) {
        try {
          return await newsletterManager.sendNewsletterInvite(sock, m.from, {
            name:              `${brand.name} Updates`,
            caption,
            newsletterJid:     menuData.channelJid,
            forwardingEnabled: true
          }, { quoted: m });
        } catch (err) {
          console.warn('[MENU newsletter] Tier 1 (newsletter invite) failed, continuing to text:', err.message);
        }
      }

      // ── Tier 2: Guaranteed plain text ─────────────────────────────────────────────────────
      return await sock.sendMessage(m.from, { text: caption }, { quoted: m });
    }
    };

    export default newsletterMenu;
    