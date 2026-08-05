import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Event Message Menu (id: 3)
 *
 * Primary tier uses sendButtonsCard (.about command rendering style).
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + buttons)
 *   2 → Native eventMessage card (proto-supported — confirmed)
 *   3 → Image banner with externalAdReply
 *   4 → Guaranteed plain text
 */
export const eventMessageMenu = {
  id: 3,
  name: 'eventMessage',
  description: 'Native WA event invitation card with dynamic start time',
  supportedMessages: ['eventMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData   = await imageManager.getMenuImage(3);
    const eventName = `✦ ${toSmallcaps(menuData.botName)} ✦`;
    const eventDesc =
      `⚡ ${toSmallcaps('Active System Stats')}:\n` +
      `• ${toSmallcaps('Total Commands')}: ${menuData.totalCommands}\n` +
      `• ${toSmallcaps('Uptime')}: ${menuData.uptime}\n` +
      `• ${toSmallcaps('Prefix')}: ${menuData.prefix}\n` +
      `• ${toSmallcaps('Users Connected')}: ${menuData.users}`;

    const bodyText = `🎉 *${eventName}*\n\n${eventDesc}\n\n` + buildTextMenu(menuData);
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
        console.warn('[MENU eventMessage] Tier 1 (sendButtonsCard) failed, trying sendEvent:', err.message);
      }
    }

    // ── Tier 2: Native eventMessage card ──────────────────────────────────
    if (capabilities.eventMessage) {
      try {
        return await baileysBridge.sendEvent(sock, m.from, {
          name:         eventName,
          description:  eventDesc,
          minutesAhead: 10,
          joinLink:     `https://wa.me/${menuData.ownerNumber || '233597514499'}`,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU eventMessage] Tier 2 (event card) failed, trying image banner:', err.message);
      }
    }

    // ── Tier 3: Image banner with externalAdReply ──────────────────────────
    try {
      const adReply = {
        title:                 eventName,
        body:                  eventDesc.slice(0, 72),
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.thumbnail || imgData.buffer;
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
      console.warn('[MENU eventMessage] Tier 3 (image banner) failed, continuing to text:', err.message);
    }

    // ── Tier 4: Guaranteed plain text + fake quote + banner ────────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${toSmallcaps(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} commands • Event Menu`,
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

export default eventMessageMenu;
