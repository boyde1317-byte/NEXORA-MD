import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

/**
 * Media Menu (id: 10)
 *
 * Rich Media Showcase with full-banner ExternalAdReply layout.
 *
 * Tiers:
 *   1 → nativeFlow interactive card with image header + quick-reply buttons
 *   2 → text + externalAdReply banner (nativeFlow unsupported)
 */
export const mediaMenu = {
  id: 10,
  name: 'media',
  description: 'Rich Media Showcase with full-banner ExternalAdReply layout',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage', 'imageMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const caption = `✦ *${toSmallcaps('Media Showcase Dashboard')}* ✦\n\n` + buildTextMenu(menuData);

    const imgData = await imageManager.getMenuImage(10);

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    // ── Tier 1: nativeFlow interactive card with buttons ───────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    caption,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: `📋 ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` },
            { text: `🏓 ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` },
            { text: `💬 ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU media] Tier 1 (nativeFlow) failed, trying adReply:', err.message);
      }
    }

    // ── Tier 2: text + externalAdReply banner ───────────────────────────────
    const contextInfo = {
      externalAdReply: {
        title:                 `${menuData.botName} ${toSmallcaps('Media Core')}`,
        body:                  `${toSmallcaps('Uptime')}: ${menuData.uptime} | ${toSmallcaps('Plugins')}: ${menuData.totalCommands}`,
        sourceUrl:             `https://wa.me/${menuData.ownerNumber || '233597514499'}`,
        mediaType:             1,
        renderLargerThumbnail: true,
        showAdAttribution:     true,
      },
    };

    if (imgData.buffer) {
      contextInfo.externalAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      contextInfo.externalAdReply.thumbnailUrl = imgData.source;

      contextInfo.externalAdReply.originalImageUrl = imgData.source;
    }

    return await sock.sendMessage(m.from, {
      text: caption,
      contextInfo,
    }, { quoted: menuData.audioQuote || m });
  }
};

export default mediaMenu;
