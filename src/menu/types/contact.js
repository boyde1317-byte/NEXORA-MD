import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { config } from '../../../config/index.js';
import brand from '../../../config/brand.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildNavigationButton, buildPillButton, buildPillUrlButton, buildPillCopyButton } from './buttonsCard.js';

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/**
 * Contact Menu (id: 9) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * ONE message: nativeFlow interactive card (image header + body + buttons) quoted
 * inside a fake contactMessage so the reply bar shows a tappable vCard for the owner.
 *
 * Uses the fork's simple button format:
 *   { text, url }   → cta_url
 *   { text, id }    → quick_reply
 *   { text, copy }  → cta_copy
 *
 * The card is a real contactMessage (sendContactCard), not a quote: WhatsApp
 * (0@s.whatsapp.net participant + status@broadcast remoteJid), AI attribution
 * carried in the vcard's waid. WA never looks up the original message in
 * chat history — no ghost thread.
 *
 * Image strategy:
 *   imgData.buffer is passed as `image:` on the Tier 1 nativeFlow card.
 *   If the buffer download failed, the raw URL is passed as { url }.
 *   Tier 2 falls back to an externalAdReply banner on a plain text message.
 *   Tier 3 is bare text with the contact badge.
 *
 * Tiers:
 *   1 → nativeFlow card (image + buttons) + owner contact card in reply bar
 *   2 → text + externalAdReply banner + owner contact card in reply bar
 *   3 → guaranteed plain text + owner contact card in reply bar
 */
export const contactMenu = {
  id: 9,
  name: 'contact',
  description: 'nativeFlow card with image header + owner vCard contact badge in the reply bar',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = (await imageManager.getMenuImage(9).catch(() => null)) || {};

    // ── Step 0: the style's own card — a real contactMessage ──────────────
    let cardQuote = null;
    try {
      cardQuote = await baileysBridge.sendContactCard(sock, m.from, {
        displayName: `${brand.creator || 'Owner'} · ${displayName(menuData.botName)}`,
        phone:       (config.owner && config.owner[0]) || '233533416608',
        org:         brand.name,
      });
    } catch (err) {
      console.warn('[MENU contact] contact card failed, sending the menu only:', err.message);
    }
    const ownerNumber  = (config.owner[0] || '233597514499').replace(/[^0-9]/g, '');
    const ownerName    = menuData.ownerName || brand.creator || 'Owner';

    const menuText   = buildTextMenu(menuData);
    const footerText = `${displayName(menuData.botName)} • ${menuData.totalCommands} ${toSmallcaps('commands')}`;

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 1: nativeFlow card (image + buttons) + contact badge ──────────
    try {
      return await baileysBridge.sendButtonsCard(sock, m.from, {
        body:       menuText,
        footer:     footerText,
        title:      `✦ ${displayName(menuData.botName)} ✦`,
        thumbnail:  imagePayload,
        buttons: [
          buildPillUrlButton(`💬 ${toSmallcaps('Message')} ${ownerName}`, `https://wa.me/${ownerNumber}`),
          buildPillButton(`📋 ${toSmallcaps('Command List')}`, `${menuData.prefix}menulist`),
          buildPillCopyButton(`📎 ${toSmallcaps('Copy Prefix')}`, menuData.prefix),
          buildPillButton(`🤖 ${toSmallcaps('System Stats')}`, `${menuData.prefix}menu aiDynamic`),
          buildNavigationButton(menuData.prefix),
        ],
      }, { quoted: cardQuote });
    } catch (err) {
      console.warn('[MENU contact] Tier 1 (nativeFlow + image + contact quote) failed, trying adReply:', err.message);
    }

    // ── Tier 2: text + externalAdReply banner + contact badge ─────────────
    try {
      const adReply = {
        title:                 `✦ ${displayName(menuData.botName)} ✦`,
        body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} • ${toSmallcaps('Prefix')}: ${menuData.prefix}`,
        sourceUrl:             `https://wa.me/${ownerNumber}`,
        mediaType:             1,
        renderLargerThumbnail: true,
      };
      if (imgData.buffer) {
        adReply.thumbnail = imgData.thumbBuffer;
      } else if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;

        adReply.originalImageUrl = imgData.source;
      }
      return await sock.sendMessage(m.from, {
        text:        menuText,
        contextInfo: { externalAdReply: adReply },
      });
    } catch (err) {
      console.warn('[MENU contact] Tier 2 (adReply + contact quote) failed, continuing to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + contact badge + banner ────────────
    const fallbackAdReply = {
      title:                 `✦ ${displayName(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} • ${toSmallcaps('Prefix')}: ${menuData.prefix}`,
      sourceUrl:             `https://wa.me/${ownerNumber}`,
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
      text:        menuText,
      contextInfo: { externalAdReply: fallbackAdReply },
    });
  },
};

export default contactMenu;
