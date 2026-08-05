import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeLiveLocationQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

/**
 * Location Menu (id: 8)
 *
 * Primary tier uses sendButtonsCard with live location quote in contextInfo.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style) + live location badge in reply bar
 *   2 → nativeFlow card (image header + buttons) + live location in reply bar
 *   3 → text + externalAdReply banner + live location in reply bar
 *   4 → guaranteed plain text + live location in reply bar
 */
export const locationMenu = {
  id: 8,
  name: 'location',
  description: 'nativeFlow card with image header + live location badge in the reply bar',
  supportedMessages: ['interactiveMessage', 'liveLocationMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(8);
    const menuText   = buildTextMenu(menuData);
    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    const locationQuote = buildFakeLiveLocationQuote({
      caption: `📍 ${toSmallcaps(menuData.botName || 'NEXORA-MD')} — ${toSmallcaps('Bot Command')} ✦`,
    });

    const contextInfo = {
      stanzaId:      locationQuote.key.id,
      participant:   locationQuote.key.participant,
      remoteJid:     locationQuote.key.remoteJid,
      quotedMessage: locationQuote.message,
    };

    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);

    // ── Tier 1: sendButtonsCard + live location badge in reply bar ──────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      menuText,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands • ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '📋 All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU location] Tier 1 (sendButtonsCard + location quote) failed, trying sendNativeFlow:', err.message);
      }
    }

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 2: nativeFlow card (image + buttons) + live location badge ────
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    menuText,
        footer:  footerText,
        title:   `✦ ${menuData.botName.toUpperCase()} ✦`,
        image:   imagePayload,
        buttons: [
          { text: '📋 Command List',   id:   `${menuData.prefix}menulist` },
          { text: '📎 Copy Prefix',    copy: menuData.prefix },
          { text: '🤖 System Stats',    id:   `${menuData.prefix}menu aiDynamic` },
          { text: '💬 Contact',        url:  'https://wa.me/233533416608' },
        ],
      }, { quoted: locationQuote });
    } catch (err) {
      console.warn('[MENU location] Tier 2 (nativeFlow + image + location quote) failed, trying adReply:', err.message);
    }

    // ── Tier 3: text + externalAdReply banner + live location badge ────────
    try {
      const adReply = {
        title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
        body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.buffer;
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
        adReply.originalImageUrl = imgData.source;
      }
      return await sock.sendMessage(m.from, {
        text:        menuText,
        contextInfo: { externalAdReply: adReply },
      }, { quoted: locationQuote });
    } catch (err) {
      console.warn('[MENU location] Tier 3 (adReply + location quote) failed, continuing to text:', err.message);
    }

    // ── Tier 4: guaranteed plain text + live location badge + banner ────────
    const fallbackAdReply = {
      title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
      body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      fallbackAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        menuText,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: locationQuote });
  },
};

export default locationMenu;
