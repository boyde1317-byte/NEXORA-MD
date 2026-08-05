import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { newsletterManager } from '../../newsletter/newsletterManager.js';
import brand from '../../../config/brand.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildAboutContextInfo, resolveThumbnail, buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Newsletter Menu (id: 7)
 *
 * Sends the menu as an .about style card with newsletter admin invite fallback.
 *
 * CAPABILITY GATE:
 *   `capabilities.newsletter.adminInviteMessage` is always false because
 *   NewsletterAdminInviteMessage is a nested proto type that protobufjs cannot
 *   detect via direct property introspection. Do NOT gate on it here.
 *
 *   Instead, gate on `capabilities.newsletter.enabled` (true — static verdict)
 *   AND require a valid `menuData.channelJid`. The runtime socket check in
 *   baileysScanner.js verifies that newsletter methods are actually available.
 *   Any actual failure (no channel, wrong account type) is caught by fallback tiers.
 *
 * Tiers:
 *   1 → sendButtonsCard with thumbnail + catalog quote + navigation buttons
 *   2 → image banner + newsletter admin invite card (requires channelJid)
 *   3 → imageMessage with caption (plain-text style + image in one bubble)
 *   4 → guaranteed plain text (image unavailable or send failed)
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
      `✦ *${toSmallcaps(menuData.botName + ' Menu')}* ✦\n\n` +
      `_Verified Partner • Official Channel_\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 *${toSmallcaps('System Brief')}*\n` +
      `• *${toSmallcaps('Status')}:* Optimal\n` +
      `• *${toSmallcaps('Framework')}:* Baileys\n` +
      `• *${toSmallcaps('Total Commands')}:* ${menuData.totalCommands}\n` +
      `• *${toSmallcaps('System Uptime')}:* ${menuData.uptime}\n\n` +
      textContent;

    const footerText = `${menuData.botName} • ${toSmallcaps('Official Channel')}`;

    // ── Tier 1: sendButtonsCard ───────────────────────────────────────────
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });

    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      caption,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands • ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '📋 All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: aboutCtx,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU newsletter] Tier 1 (sendButtonsCard) failed, trying newsletter invite:', err.message);
      }
    }

    // ── Tier 2: image banner + newsletter admin invite card ───────────────
    const hasChannel = !!menuData.channelJid;

    if (capabilities.newsletter?.enabled && hasChannel) {
      try {
        // Send image banner first — newsletter invite has no image field.
        if (imgData.buffer) {
          await sock.sendMessage(m.from, {
            image:    imgData.buffer,
            mimetype: imgData.mimetype,
            caption:  `📡 *${toSmallcaps(menuData.botName)}* — ${toSmallcaps('Broadcasting now')}`,
          }, { quoted: menuData.audioQuote || m });
        } else if (imgData.source?.startsWith('http')) {
          await sock.sendMessage(m.from, {
            image:   { url: imgData.source },
            caption: `📡 *${toSmallcaps(menuData.botName)}* — ${toSmallcaps('Broadcasting now')}`,
          }, { quoted: menuData.audioQuote || m });
        }

        return await newsletterManager.sendNewsletterInvite(sock, m.from, {
          name:              `${brand.name} Updates`,
          caption,
          newsletterJid:     menuData.channelJid,
          forwardingEnabled: true,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU newsletter] Tier 2 (image + newsletter invite) failed:', err.message);
        // Fall through to Tier 3
      }
    } else if (!hasChannel) {
      console.warn('[MENU newsletter] No channelJid in menuData — skipping Tier 2. ' +
        'Set CHANNEL_JID in .env or config to enable newsletter invite cards.');
    }

    // ── Tier 3: imageMessage with caption ─────────────────────────────────
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
      console.warn('[MENU newsletter] Tier 3 (imageMessage) failed, continuing to text:', err.message);
    }

    // ── Tier 4: Guaranteed plain text + fake quote + banner ────────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData?.buffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${toSmallcaps(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} commands • Newsletter`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData?.buffer) {
      fallbackAdReply.thumbnail = imgData.buffer;
    } else if (imgData?.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        caption,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: fakeImgQuote });
  },
};

export default newsletterMenu;
