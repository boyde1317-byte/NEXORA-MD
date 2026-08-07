import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildPillButton, buildPillUrlButton, buildNavigationButton } from './buttonsCard.js';

/**
 * Event Message Menu (id: 3)
 *
 * Uses sendButtonsCard (buttonsMessage proto) as Tier 1 for universal
 * WhatsApp client compatibility. The native eventMessage is retained as
 * Tier 2 for clients that support event cards.
 *
 * Tiers:
 *   1 → sendButtonsCard with image header + event-themed subtitle + adReply
 *   2 → Native eventMessage card (proto-supported)
 *   3 → Image banner with externalAdReply
 *   4 → Guaranteed plain text
 */
export const eventMessageMenu = {
  id: 3,
  name: 'eventMessage',
  description: 'Event-themed pill-button card with image header + optional native event fallback',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'eventMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData   = await imageManager.getMenuImage(3);
    const eventName = `\u2726 ${toSmallcaps(menuData.botName)} \u2726`;
    const eventDesc =
      `\u26A1 ${toSmallcaps('Active System Stats')}:\n` +
      `\u2022 ${toSmallcaps('Total Commands')}: ${menuData.totalCommands}\n` +
      `\u2022 ${toSmallcaps('Uptime')}: ${menuData.uptime}\n` +
      `\u2022 ${toSmallcaps('Prefix')}: ${menuData.prefix}\n` +
      `\u2022 ${toSmallcaps('Users Connected')}: ${menuData.users}`;

    const bodyText = `\u{1F389} *${eventName}*\n\n${eventDesc}\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} \u2502 ${toSmallcaps('Event Menu')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply
    const adReply = {
      title:                 eventName,
      body:                  eventDesc.slice(0, 72),
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    // ── Tier 1: sendButtonsCard with image header + event subtitle ────────
    if (imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      `\u{1F389} ${toSmallcaps('System Event')} \u{1F389}`,
          subtitle:   `${toSmallcaps('Commands')}: ${menuData.totalCommands} \u2502 ${toSmallcaps('Uptime')}: ${menuData.uptime}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton('\u{1F3D1} Ping Speed',        `${menuData.prefix}ping`),
            buildPillButton('\u{1F4CB} Command List',       `${menuData.prefix}menulist`),
            buildPillButton('\u{1F916} System Stats',       `${menuData.prefix}menu aiDynamic`),
            buildPillUrlButton('\u{1F4AC} Contact Dev',    'https://wa.me/233533416608'),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU eventMessage] Tier 1 (sendButtonsCard) failed, trying native event:', err.message);
      }
    }

    // ── Tier 2: Native eventMessage card ──────────────────────────────────
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

    // ── Tier 3: Image banner with externalAdReply ──────────────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU eventMessage] Tier 3 (image banner) failed, continuing to text:', err.message);
    }

    // ── Tier 4: Guaranteed plain text + fake quote + banner ────────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default eventMessageMenu;
