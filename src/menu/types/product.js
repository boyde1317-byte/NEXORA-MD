import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

/**
 * Product / Offer Overlay Menu (id: 5) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * Uses the fork's `offerText` API to attach a limited_time_offer banner to the
 * top of an interactive card. This is the proper offer overlay mechanism — it
 * creates a standout promotional strip (title text + optional URL / copy code)
 * above the card body, entirely within the WA nativeFlow spec.
 *
 * offerText    → text shown on the offer banner
 * offerUrl     → tappable URL on the banner
 *
 * Tiers:
 *   1 → nativeFlow + offerText overlay (image header + offer banner + buttons)
 *   2 → image with caption + externalAdReply (offer banner unsupported on client)
 *   3 → guaranteed plain text
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

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 1: nativeFlow with offer overlay ─────────────────────────────
    // offerText injects a limited_time_offer object into messageParamsJson, which
    // renders as a highlighted offer banner at the top of the interactive card.
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:      bodyText,
        footer:    footerText,
        image:     imagePayload,
        offerText: '🎁 Free Premium Bot Access',
        offerUrl:  'https://wa.me/233533416608',
        buttons: [
          { text: '💬 Contact Developer', url:  'https://wa.me/233533416608' },
          { text: '📋 Copy Prefix',       copy: menuData.prefix },
          { text: '🤖 System Stats',       id:   `${menuData.prefix}menu aiDynamic` },
          { text: '🎨 Browse Menu Styles', id:   `${menuData.prefix}menulist` },
        ],
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU product] Tier 1 (offer overlay) failed, trying image banner:', err.message);
    }

    // ── Tier 2: image with caption + externalAdReply ──────────────────────
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
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU product] Tier 2 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text ─────────────────────────────────────
    return await sock.sendMessage(m.from, { text: bodyText }, { quoted: menuData.audioQuote || m });
  },
};

export default productMenu;
