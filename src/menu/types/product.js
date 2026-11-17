import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import brand from '../../../config/brand.js';
import { config } from '../../../config/index.js';

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/**
 * Product / Offer Overlay Menu (id: 17) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * NOTE: was previously id 5, which collided with buttonsCard.js (also id 5).
 * Renumbered to 17 (next free slot) to fix silent menu-lookup conflicts —
 * `.menu 5` and `.menulist`'s id column were pointing to different menus
 * depending on module registration order.
 *
 * Uses the fork's `offerText` API to attach a limited_time_offer banner to the
 * top of an interactive card. This is the proper offer overlay mechanism — it
 * creates a standout promotional strip (title text + optional URL / copy code)
 * above the card body, entirely within the WA nativeFlow spec.
 *
 * offerText    → text shown on the offer banner
 * offerUrl     → tappable URL on the banner
 * offerCode    → copyable promo code on the banner
 * offerExpiry  → Unix timestamp (seconds) for the offer's expiration countdown
 *
 * Tiers:
 *   1 → nativeFlow + offerText overlay (image header + offer banner + buttons), quoted by product card
 *   2 → image with caption + externalAdReply (offer banner unsupported on client), quoted by product card
 *   3 → guaranteed plain text, quoted by product card
 */
export const productMenu = {
  id: 20,
  name: 'product',
  description: 'Offer overlay card — limited_time_offer banner + image header + action buttons',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = (await imageManager.getMenuImage(5).catch(() => null)) || {};

    // ── Step 0: the style's own card ──────────────────────────────────────
    // WhatsApp does not render a productMessage as a quote preview, so the card
    // has to travel as its own message; quoted alone it looks like any other
    // text reply and the menu reads as one more pill list.
    try {
      await baileysBridge.sendProduct(sock, m.from, {
        title:            `${displayName(menuData.botName)} · ${menuData.totalCommands} ${toSmallcaps('commands')}`,
        description:      brand.description || `${brand.name} by ${brand.creator}`,
        productId:        'nexora-menu',
        currency:         'USD',
        price:            0,
        footer:           `${menuData.prefix}menulist`,
        thumbnail:        imgData.buffer || imgData.source,
        businessOwnerJid: `${String((config.owner && config.owner[0]) || '233533416608').replace(/[^0-9]/g, '')}@s.whatsapp.net`,
      });
    } catch (err) {
      console.warn('[MENU product] product card failed, sending the menu only:', err.message);
    }
    const bodyText  = `✦ ${displayName(menuData.botName)} ✦\n\n` + buildTextMenu(menuData);
    const footerText = `${displayName(menuData.botName)} • ${menuData.totalCommands} ${toSmallcaps('commands')}`;

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
        offerText:  '🎁 Free Premium Access — Expires Soon',
        offerUrl:   'https://wa.me/233533416608',
        offerCode:  'NEXORA-FREE',
        offerExpiry: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // expires in 7 days
        buttons: [
          { text: `💬 ${toSmallcaps('Contact Developer')}`, url:  'https://wa.me/233533416608' },
          { text: `📎 ${toSmallcaps('Copy Prefix')}`,       copy: menuData.prefix },
          { text: `🤖 ${toSmallcaps('System Stats')}`,       id:   `${menuData.prefix}menu aiDynamic` },
          { text: `🎨 ${toSmallcaps('Browse Menu Styles')}`, id:   `${menuData.prefix}menulist` },
        ],
      });
    } catch (err) {
      console.warn('[MENU product] Tier 1 (offer overlay) failed, trying image banner:', err.message);
    }

    // ── Tier 2: image with caption + externalAdReply ──────────────────────
    try {
      const adReply = {
        title:                 `✦ ${displayName(menuData.botName)} ✦`,
        body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} • ${menuData.uptime} ${toSmallcaps('uptime')}`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.thumbBuffer;
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        });
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;

        adReply.originalImageUrl = imgData.source;
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        });
      }
    } catch (err) {
      console.warn('[MENU product] Tier 2 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + fake product quote + banner ─────────
    const fallbackAdReply = {
      title:                 `✦ ${displayName(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} • ${menuData.uptime}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      fallbackAdReply.thumbnail = imgData.thumbBuffer;
    } else if (imgData.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: fallbackAdReply },
    });
  },
};

export default productMenu;
