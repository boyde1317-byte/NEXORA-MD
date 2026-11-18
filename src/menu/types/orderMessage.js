import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeOrderQuote } from '../../lib/waUtils.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildNavigationButton, buildPillButton, buildPillUrlButton, buildPillCopyButton, buildCtaReplyButton, buildCtaUrlButton, buildCtaCopyButton } from './buttonsCard.js';
import brand from '../../../config/brand.js';
import { config } from '../../../config/index.js';

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/**
 * Order Message Menu (id: 14) — enhanced for rich-messages.
 *
 * Uses sendCtaCard (interactiveMessage with CTA rows) as Tier 1 for universal
 * WhatsApp client compatibility. A fake orderMessage quote is used for
 * the reply bar (business order card with thumbnail + item count).
 *
 * Tiers:
 *   1 → sendCtaCard with image header + subtitle + embedded adReply, quoted by order card
 *   2 → imageMessage with caption, quoted by order card
 *   3 → guaranteed plain text
 */
export const orderMessageMenu = {
  id: 14,
  name: 'orderMessage',
  description: 'Interactive card.',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'orderMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = (await imageManager.getMenuImage(14).catch(() => null)) || {};


    // Build richer body text with visual stat rows
    const statBlock = [
      ``,
      '',
      asciiBuilder.statRow('Total Commands', menuData.totalCommands),
      asciiBuilder.statRow('Prefix', menuData.prefix),
      asciiBuilder.statRow('Uptime', menuData.uptime),
      '',
    ].join('\n');

    const bodyText = statBlock + buildTextMenu(menuData);
    const footerText = `Stay Alive 🦕`;

    // ── Resolve image payload once ─────────────────────────────────────────
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Build order-quote thumbnail ────────────────────────────────────────
    // Use the small mock thumbnail for the quoted message (not the full-size
    // buffer) to avoid inflating the quoted message proto. The full image is
    // uploaded separately by sendButtonsCard for the card header.
    let orderQuote;
    try {
      orderQuote = buildFakeOrderQuote({
        orderId:    'NEXORA-CMD-PACK',
        itemCount:  menuData.totalCommands,
        thumbnail:  imgData.thumbnail || undefined,
        title:      menuData.botName,
      });
    } catch (_) {
      orderQuote = menuData.audioQuote || m;
    }

    // Build embedded externalAdReply
    const adReply = {
      title:                 ` ${displayName(menuData.botName)}`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Order Card')}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.thumbBuffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    // ── Tier 1: sendButtonsCard with image header + subtitle + embedded adReply ──
    if (imagePayload) {
      try {
        return await baileysBridge.sendCtaCard(sock, m.from, {
          dim: true,
          body:       bodyText,
          footer:     footerText,
          title:      ``,
          subtitle:   `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Prefix')}: ${menuData.prefix}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton(`\u{1F3A8} ${toSmallcaps('Browse Menu Styles')}`, `${menuData.prefix}menulist`),
            buildPillButton(`\u{1F916} ${toSmallcaps('System Stats')}`,       `${menuData.prefix}menu aiDynamic`),
            buildCtaReplyButton(`\u2630 ${toSmallcaps('All Commands')}`, `${menuData.prefix}help`),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      } catch (err) {
        console.warn('[MENU orderMessage] Tier 1 (sendButtonsCard + adReply + order) failed, trying image:', err.message);
      }
    }

    // ── Tier 2: imageMessage with caption ─────────────────────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      }
    } catch (err) {
      console.warn('[MENU orderMessage] Tier 2 (image + order quote) failed, continuing to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + order quote + banner ────────────────
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: orderQuote });
  },
};

export default orderMessageMenu;
