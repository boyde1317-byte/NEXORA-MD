import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';

/**
 * Document Interactive Menu (id: 1) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * Uses the fork's high-level sendNativeFlow API:
 *   sock.sendMessage(jid, { nativeFlow: [...], text, footer, image }) via baileysBridge.
 *
 * Button format — fork's simple declarative style (no raw proto):
 *   { text, id }    → quick_reply
 *   { text, url }   → cta_url
 *   { text, copy }  → cta_copy
 *
 * Tiers:
 *   1 → nativeFlow interactive card with image header + 3 action buttons
 *   2 → image with caption + externalAdReply banner
 *   3 → guaranteed plain text
 */
export const documentInteractiveMenu = {
  id: 1,
  name: 'documentInteractive',
  description: 'Interactive card — image header + quick-reply and URL action buttons',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(1);
    const footerText = footerManager.getFooter() || `${menuData.botName} • Uptime: ${menuData.uptime}`;
    const bodyText   = `✦ *${menuData.botName.toUpperCase()}* ✦\n\n` + buildTextMenu(menuData);

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 1: nativeFlow interactive card with image header ─────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    bodyText,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: '📋 Switch Menu Style', id: `${menuData.prefix}menulist` },
            { text: '⚡ System Info',        id: `${menuData.prefix}menu aiDynamic` },
            { text: '🏓 Ping Bot',           id: `${menuData.prefix}ping` },
            { text: '💬 Contact Developer',  url: 'https://wa.me/233533416608' },
            { text: '📋 Copy Prefix',        copy: menuData.prefix },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU documentInteractive] Tier 1 (nativeFlow) failed, trying image banner:', err.message);
      }
    }

    // ── Tier 2: image with caption + externalAdReply ──────────────────────
    try {
      const adReply = {
        title:                 `${menuData.botName} ✦`,
        body:                  `${menuData.totalCommands} commands • Uptime: ${menuData.uptime}`,
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
      console.warn('[MENU documentInteractive] Tier 2 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text ─────────────────────────────────────
    return await sock.sendMessage(m.from, { text: bodyText }, { quoted: menuData.audioQuote || m });
  },
};

export default documentInteractiveMenu;
