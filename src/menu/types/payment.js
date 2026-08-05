import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Payment Menu (id: 2)
 *
 * Primary tier uses sendButtonsCard (.about command rendering style).
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + buttons)
 *   2 → requestPaymentMessage (proto-supported; may silently no-op on personal accounts)
 *   3 → Guaranteed plain text fallback
 */
export const paymentMenu = {
  id: 2,
  name: 'payment',
  description: 'Request Payment invoice card (business-account feature; auto-degrades on personal accounts)',
  supportedMessages: ['requestPaymentMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData     = await imageManager.getMenuImage(2);
    const bodyText    = `✦ *${toSmallcaps(menuData.botName)}* ✦\n\n` + buildTextMenu(menuData);
    const footerText  = `${menuData.botName} • ${menuData.totalCommands} commands`;

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
        console.warn('[MENU payment] Tier 1 (sendButtonsCard) failed, trying sendPayment:', err.message);
      }
    }

    // ── Tier 2: Native payment card ───────────────────────────────────────
    if (capabilities.requestPayment) {
      try {
        return await baileysBridge.sendPayment(sock, m.from, {
          amount:   45000,
          currency: 'USD',
          note:     bodyText,
          expiry:   Math.floor(Date.now() / 1000) + 86400,
          image:    imgData?.buffer ?? null,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU payment] Tier 2 (payment card) failed:', err.message);
      }
    }

    // ── Tier 3: Guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData?.buffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${toSmallcaps(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} commands • Payment Menu`,
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
      text:        bodyText,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: fakeImgQuote });
  },
};

export default paymentMenu;
