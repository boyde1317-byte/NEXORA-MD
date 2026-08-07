import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildPillButton, buildPillUrlButton, buildPillCopyButton, buildNavigationButton } from './buttonsCard.js';

/**
 * Product / Offer Menu (id: 17) — rewritten for universal compatibility.
 *
 * NOTE: was previously id 5, which collided with buttonsCard.js (also id 5).
 * Renumbered to 17 (next free slot) to fix silent menu-lookup conflicts.
 *
 * Uses sendButtonsCard (buttonsMessage proto) as Tier 1 for universal
 * WhatsApp client compatibility. The offer text is embedded as a subtitle
 * + externalAdReply banner.
 *
 * Tiers:
 *   1 → sendButtonsCard with image header + offer subtitle + embedded adReply
 *   2 → imageMessage with caption + externalAdReply
 *   3 → guaranteed plain text
 */
export const productMenu = {
  id: 17,
  name: 'product',
  description: 'Offer-style pill-button card with promotional banner + image header',
  supportedMessages: ['interactiveMessage', 'buttonsMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData   = await imageManager.getMenuImage(5);
    const bodyText  = `\u2726 *${menuData.botName.toUpperCase()}* \u2726\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply with offer banner styling
    const adReply = {
      title:                 `\u{1F381} ${toSmallcaps('Free Premium Access')} \u2014 ${toSmallcaps('Expires Soon')}`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Offer Code')}: NEXORA-FREE`,
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

    // ── Tier 1: sendButtonsCard with image header + offer subtitle + adReply ──
    if (imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      `\u2726 ${toSmallcaps('Premium Command Pack')} \u2726`,
          subtitle:   `\u{1F381} ${toSmallcaps('Free Premium')} \u2502 ${toSmallcaps('Code')}: NEXORA-FREE`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillUrlButton('\u{1F4AC} Contact Developer',  'https://wa.me/233533416608'),
            buildPillCopyButton('\u{1F4CE} Copy Offer Code',   'NEXORA-FREE'),
            buildPillButton('\u{1F916} System Stats',          `${menuData.prefix}menu aiDynamic`),
            buildPillButton('\u{1F3A8} Browse Menu Styles',    `${menuData.prefix}menulist`),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU product] Tier 1 (sendButtonsCard + offer) failed, trying image banner:', err.message);
      }
    }

    // ── Tier 2: imageMessage with caption + externalAdReply ────────────────
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
      console.warn('[MENU product] Tier 2 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default productMenu;
