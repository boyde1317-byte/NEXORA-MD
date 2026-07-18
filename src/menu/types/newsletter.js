import { capabilities } from '../../core/capabilities.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { newsletterManager } from '../../newsletter/newsletterManager.js';
import brand from '../../../config/brand.js';

/**
 * Newsletter Menu (id: 7)
 *
 * Sends the menu as a WhatsApp Channel (newsletter) admin invite card.
 *
 * CAPABILITY GATE:
 *   `capabilities.newsletter.adminInviteMessage` is always false because
 *   NewsletterAdminInviteMessage is a nested proto type that protobufjs cannot
 *   detect via direct property introspection. Do NOT gate on it here.
 *
 *   Instead, gate on `capabilities.newsletter.enabled` (true — static verdict)
 *   AND require a valid `menuData.channelJid`. The runtime socket check in
 *   baileysScanner.js verifies that newsletter methods are actually available.
 *   Any actual failure (no channel, wrong account type) is caught by Tier 2.
 *
 * Image strategy:
 *   The NewsletterAdminInviteMessage proto does not expose an image field via
 *   the fork's sendNewsletterInvite API. So we send the menu image as a
 *   dedicated imageMessage immediately before the invite card — this gives the
 *   invite a visual header without modifying the newsletter proto.
 *   For the plain-text fallback (Tier 2) we embed the image directly as an
 *   imageMessage with the caption so it appears as a single rich card.
 *
 * Tiers:
 *   1 → image banner + newsletter admin invite card (requires channelJid)
 *   2 → imageMessage with caption (plain-text style + image in one bubble)
 *   3 → guaranteed plain text (image unavailable or send failed)
 */
export const newsletterMenu = {
  id: 7,
  name: 'newsletter',
  description: 'WhatsApp Channel/Newsletter official announcement style feed',
  supportedMessages: ['newsletterAdminInviteMessage', 'newsletterFollowerInviteMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(7);

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

    // ── Tier 1: image banner + newsletter admin invite card ───────────────
    const hasChannel = !!menuData.channelJid;

    if (capabilities.newsletter?.enabled && hasChannel) {
      try {
        // Send image banner first — newsletter invite has no image field.
        if (imgData.buffer) {
          await sock.sendMessage(m.from, {
            image:    imgData.buffer,
            mimetype: imgData.mimetype,
            caption:  `📡 *${menuData.botName.toUpperCase()}* — Broadcasting now`,
          }, { quoted: menuData.audioQuote || m });
        } else if (imgData.source?.startsWith('http')) {
          await sock.sendMessage(m.from, {
            image:   { url: imgData.source },
            caption: `📡 *${menuData.botName.toUpperCase()}* — Broadcasting now`,
          }, { quoted: menuData.audioQuote || m });
        }

        return await newsletterManager.sendNewsletterInvite(sock, m.from, {
          name:              `${brand.name} Updates`,
          caption,
          newsletterJid:     menuData.channelJid,
          forwardingEnabled: true,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU newsletter] Tier 1 (image + newsletter invite) failed:', err.message);
        // Fall through to Tier 2
      }
    } else if (!hasChannel) {
      console.warn('[MENU newsletter] No channelJid in menuData — skipping Tier 1. ' +
        'Set CHANNEL_JID in .env or config to enable newsletter invite cards.');
    }

    // ── Tier 2: imageMessage with caption ─────────────────────────────────
    // Sends image + full menu text as one rich bubble. Preferred over bare text.
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:    imgData.buffer,
          mimetype: imgData.mimetype,
          caption,
        }, { quoted: menuData.audioQuote || m });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:   { url: imgData.source },
          caption,
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU newsletter] Tier 2 (imageMessage) failed, continuing to text:', err.message);
    }

    // ── Tier 3: Guaranteed plain text ────────────────────────────────────
    return await sock.sendMessage(m.from, { text: caption }, { quoted: menuData.audioQuote || m });
  },
};

export default newsletterMenu;
