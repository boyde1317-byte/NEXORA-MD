import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

/**
 * Native Flow Menu (id: 4) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * Uses the fork's simple declarative button format:
 *   { text, id }    → quick_reply
 *   { text, url }   → cta_url  (merchant_url auto-set by prepareNativeFlowButtons)
 *   { text, copy }  → cta_copy
 *
 * No manual proto construction. No buttonParamsJson. No raw name/params objects.
 *
 * Tiers:
 *   1 → nativeFlow interactive card with image header (URL links + quick-reply + copy)
 *   2 → text with externalAdReply banner (no button support on client)
 */
export const nativeFlowMenu = {
  id: 4,
  name: 'nativeFlow',
  description: 'Advanced Native Flow — URL links, clipboard copy, quick-reply actions',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(4);
    const bodyText   = `⚡ *NATIVE FLOW INTERACTIVE ENGINE*\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} • Native Flow Active`;

    // ── Tier 1: nativeFlow buttons with image header ──────────────────────
    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    bodyText,
        footer:  footerText,
        title:   '🌟 MAIN CONTROL PANEL',
        image:   imagePayload,
        buttons: [
          { text: '💬 Contact Developer',  url:  'https://wa.me/233533416608' },
          { text: '📢 Official Channel',   url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
          { text: '📋 Copy Prefix',        copy: menuData.prefix },
          { text: '🤖 System Stats',        id:   `${menuData.prefix}menu aiDynamic` },
          { text: '🎨 Change Menu Style',   id:   `${menuData.prefix}menulist` },
        ],
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 1 (native flow + image) failed, trying adReply:', err.message);
    }

    // ── Tier 2: text + externalAdReply banner ─────────────────────────────
    try {
      const adReply = {
        title:                 `${menuData.botName} ✦`,
        body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.buffer;
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
      }
      return await sock.sendMessage(m.from, {
        text:        bodyText,
        contextInfo: { externalAdReply: adReply },
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 2 (adReply) failed, escalating to text:', err.message);
      throw err; // runWithFallback → plain text
    }
  },
};

export default nativeFlowMenu;
