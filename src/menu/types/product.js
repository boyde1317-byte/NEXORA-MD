import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeImageQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Product / Offer Overlay Menu (id: 5)
 *
 * Primary tier uses sendButtonsCard (.about command rendering style).
 *
 * Tiers:
 *   1 → sendButtonsCard (thumbnail header + catalog quote + navigation buttons)
 *   2 → nativeFlow + offerText overlay (image header + offer banner + buttons)
 *   3 → image with caption + externalAdReply (offer banner unsupported on client)
 *   4 → guaranteed plain text
 */
export const productMenu = {
  id: 5,
  name: 'product',
  description: 'Offer overlay card — limited_time_offer banner + image header + action buttons',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData   = await imageManager.getMenuImage(5);
    const bodyText  = `✦ *${menuData.botName.toUpperCase()}* ✦\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });

    // ── Tier 1: sendButtonsCard (.about rendering style) ───────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      bodyText,
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
        console.warn('[MENU product] Tier 1 (sendButtonsCard) failed, trying offer overlay:', err.message);
      }
    }

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 2: nativeFlow with offer overlay ─────────────────────────────
    // offerText injects a limited_time_offer object into messageParamsJson, which
    // renders as a highlighted offer banner at the top of the interactive card.
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:      bodyText,
        footer:    footerText,
        image:     imagePayload,
        offerText:  '🎁 Free Premium Access — Expires Soon',
        offerUrl:   'https://wa.me/233533416608',
        offerCode:  'NEXORA-FREE',
        offerExpiry: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // expires in 7 days
        buttons: [
          { text: '💬 Contact Developer', url:  'https://wa.me/233533416608' },
          { text: '📎 Copy Prefix',       copy: menuData.prefix },
          { text: '🤖 System Stats',       id:   `${menuData.prefix}menu aiDynamic` },
          { text: '🎨 Browse Menu Styles', id:   `${menuData.prefix}menulist` },
        ],
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU product] Tier 2 (offer overlay) failed, trying image banner:', err.message);
    }

    // ── Tier 3: image with caption + externalAdReply ──────────────────────
    try {
      const adReply = {
        title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
        body:                  `${menuData.totalCommands} commands • ${menuData.uptime} uptime`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.buffer;
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
        adReply.originalImageUrl = imgData.source;
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU product] Tier 3 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 4: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${menuData.botName.toUpperCase()} ✦`,
      body:                  `${menuData.totalCommands} commands • ${menuData.uptime}`,
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
      text:        bodyText,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: fakeImgQuote });
  },
};

export default productMenu;
