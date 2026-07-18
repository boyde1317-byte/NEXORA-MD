import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeOrderQuote } from '../../lib/waUtils.js';

/**
 * Order Message Menu (id: 14) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * One message: nativeFlow interactive card (image header + buttons) quoted inside
 * a fake orderMessage so the reply bar renders a rich business-order card.
 *
 * Uses the fork's simple button format:
 *   { text, id }   → quick_reply
 *   { text, url }  → cta_url
 *   { text, copy } → cta_copy
 *
 * Image strategy:
 *   imagePayload is resolved ONCE from imgData:
 *     • imgData.buffer  → pre-downloaded Buffer  (preferred — fork uploads it)
 *     • imgData.source  → remote URL string      ({ url } fallback — WA fetches it)
 *   All tiers share this resolved payload so neither a missing local fallback file
 *   nor a failed URL pre-download silently strips the image.
 *
 *   The order-quote thumbnail uses the same strategy: Buffer when available,
 *   otherwise undefined (order card still renders, just without a product image).
 *
 * Tiers:
 *   1 → nativeFlow card (image header + buttons) quoted by order card
 *   2 → nativeFlow card (no image) quoted by order card
 *   3 → imageMessage with caption quoted by order card
 *   4 → guaranteed plain text
 */
export const orderMessageMenu = {
  id: 14,
  name: 'orderMessage',
  description: 'nativeFlow card + image header quoted inside a business order card',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage', 'orderMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(14);

    const bodyText =
      `✦ *${menuData.botName.toUpperCase()}* ✦\n\n` +
      buildTextMenu(menuData);
    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    // ── Resolve image payload once ─────────────────────────────────────────
    // Prefer the { url } form — WA fetches it directly, no local buffer
    // download/re-upload round trip. Buffer is only a fallback for local
    // disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Build order-quote thumbnail ────────────────────────────────────────
    // Buffer is required by buildFakeOrderQuote — omit if unavailable so the
    // order card still renders its text fields without a broken thumbnail.
    let orderQuote;
    try {
      orderQuote = buildFakeOrderQuote({
        orderId:    'NEXORA-CMD-PACK',
        itemCount:  menuData.totalCommands,
        thumbnail:  imgData.buffer || undefined,
        sellerName: menuData.botName,
        token:      menuData.prefix,
      });
    } catch (_) {
      orderQuote = menuData.audioQuote || m;
    }

    const buttons = [
      { text: '💬 Contact Developer',  url:  'https://wa.me/233533416608' },
      { text: '📢 Official Channel',   url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
      { text: '📋 Copy Prefix',        copy: menuData.prefix },
      { text: '🎨 Browse Menu Styles', id:   `${menuData.prefix}menulist` },
      { text: '🤖 System Stats',        id:   `${menuData.prefix}menu aiDynamic` },
    ];

    // ── Tier 1: nativeFlow card with image header ──────────────────────────
    // Gates on imagePayload (buffer OR url object) — not just buffer — so a
    // failed pre-download no longer silently skips to the no-image tier.
    if (imagePayload) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    bodyText,
          footer:  footerText,
          image:   imagePayload,
          buttons,
        }, { quoted: orderQuote });
      } catch (err) {
        console.warn('[MENU orderMessage] Tier 1 (image + nativeFlow) failed, trying no-image nativeFlow:', err.message);
      }
    } else {
      console.warn('[MENU orderMessage] No image payload resolved for menu14 — check database/images.json or local media directory.');
    }

    // ── Tier 2: nativeFlow card without image ──────────────────────────────
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    bodyText,
        footer:  footerText,
        title:   `✦ ${menuData.botName.toUpperCase()} ✦`,
        buttons,
      }, { quoted: orderQuote });
    } catch (err) {
      console.warn('[MENU orderMessage] Tier 2 (nativeFlow no-image) failed, trying plain image send:', err.message);
    }

    // ── Tier 3: imageMessage with caption ─────────────────────────────────
    // Also handles the URL fallback: if buffer is null but we have a remote
    // URL, { image: { url } } is a valid Baileys message payload.
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:    imgData.buffer,
          mimetype: imgData.mimetype,
          caption:  bodyText,
        }, { quoted: orderQuote });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:   { url: imgData.source },
          caption: bodyText,
        }, { quoted: orderQuote });
      }
    } catch (err) {
      console.warn('[MENU orderMessage] Tier 3 (plain image) failed, continuing to text:', err.message);
    }

    // ── Tier 4: guaranteed plain text ─────────────────────────────────────
    return await sock.sendMessage(m.from, { text: bodyText }, { quoted: menuData.audioQuote || m });
  },
};

export default orderMessageMenu;
