import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeOrderQuote, buildFakeImageQuote } from '../../lib/waUtils.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildNavigationFlowButton } from './buttonsCard.js';

/**
 * Order Message Menu (id: 14) \u2014 enhanced for rich-messages.
 *
 * Upgraded to use sendInteractive with image header + subtitle + embedded
 * externalAdReply, quoted inside a fake orderMessage for the business-order
 * card in the reply bar. Triple visual: interactive card + ad banner + order quote.
 *
 * Tiers:
 *   1 \u2192 sendInteractive with image header + subtitle + embedded adReply, quoted by order card
 *   2 \u2192 nativeFlow card with image header, quoted by order card
 *   3 \u2192 imageMessage with caption, quoted by order card
 *   4 \u2192 guaranteed plain text
 */
export const orderMessageMenu = {
  id: 14,
  name: 'orderMessage',
  description: 'Interactive card + image header + embedded ad-reply, quoted inside a business order card',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage', 'orderMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(14);

    // Build richer body text with visual stat rows
    const statBlock = [
      `\u2726 *${toSmallcaps(menuData.botName + ' Command Catalog')}* \u2726`,
      '',
      asciiBuilder.statRow('Total Commands', menuData.totalCommands),
      asciiBuilder.statRow('Prefix', menuData.prefix),
      asciiBuilder.statRow('Uptime', menuData.uptime),
      '',
    ].join('\n');

    const bodyText = statBlock + buildTextMenu(menuData);
    const footerText = `${menuData.botName} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`;

    // ── Resolve image payload once ─────────────────────────────────────────
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Build order-quote thumbnail ────────────────────────────────────────
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

    // Build embedded externalAdReply
    const adReply = {
      title:                 `\u2726 ${menuData.botName} \u2726`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Order Card')}`,
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

    // ── Tier 1: sendInteractive with image header + subtitle + embedded adReply ──
    if (imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title:    `\u2726 ${toSmallcaps('Command Catalog')} \u2726`,
            subtitle: `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Prefix')}: ${menuData.prefix}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'cta_url',     params: { display_text: '\u{1F4AC} Contact Developer',  url: 'https://wa.me/233533416608' } },
            { name: 'cta_url',     params: { display_text: '\u{1F4E1} Official Channel',   url: 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' } },
            { name: 'cta_copy',    params: { display_text: '\u{1F4CE} Copy Prefix',        copy: menuData.prefix } },
            { name: 'quick_reply', params: { display_text: '\u{1F3A8} Browse Menu Styles', id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: '\u{1F916} System Stats',       id: `${menuData.prefix}menu aiDynamic` } },
            buildNavigationFlowButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      } catch (err) {
        console.warn('[MENU orderMessage] Tier 1 (sendInteractive + adReply + order) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 2: nativeFlow card with image header ──────────────────────────
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    bodyText,
        footer:  footerText,
        image:   imagePayload,
        buttons: [
          { text: '\u{1F4AC} Contact Developer',  url:  'https://wa.me/233533416608' },
          { text: '\u{1F4E1} Official Channel',   url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
          { text: '\u{1F4CE} Copy Prefix',        copy: menuData.prefix },
          { text: '\u{1F3A8} Browse Menu Styles',   id:   `${menuData.prefix}menulist` },
          { text: '\u{1F916} System Stats',        id:   `${menuData.prefix}menu aiDynamic` },
        ],
      }, { quoted: orderQuote });
    } catch (err) {
      console.warn('[MENU orderMessage] Tier 2 (nativeFlow + image) failed, trying plain image:', err.message);
    }

    // ── Tier 3: imageMessage with caption ─────────────────────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:    imgData.buffer,
          mimetype: imgData.mimetype,
          caption:  bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:   { url: imgData.source },
          caption: bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      }
    } catch (err) {
      console.warn('[MENU orderMessage] Tier 3 (plain image) failed, continuing to text:', err.message);
    }

    // ── Tier 4: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default orderMessageMenu;
