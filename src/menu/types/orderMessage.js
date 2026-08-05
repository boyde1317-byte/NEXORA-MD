import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { buildFakeOrderQuote, buildFakeImageQuote, buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

/**
 * Order Message Menu (id: 14) — .about-style rendering.
 *
 * Primary tier uses sendButtonsCard (thumbnail header + product catalog quote
 * + pill buttons), matching the .about command's visual style.
 * The order card quote is retained in Tier 2 (sendInteractive).
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + pill buttons)
 *   2 → sendInteractive with image header + subtitle + embedded adReply, quoted by order card
 *   3 → nativeFlow card with image header, quoted by order card
 *   4 → imageMessage with caption, quoted by order card
 *   5 → guaranteed plain text
 */
export const orderMessageMenu = {
  id: 14,
  name: 'orderMessage',
  description: 'About-style buttons card with thumbnail header + catalog quote + order card fallback',
  supportedMessages: ['buttonsMessage', 'interactiveMessage', 'nativeFlowMessage', 'orderMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(14);

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

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build order-quote for fallback tiers
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

    // Build embedded externalAdReply for fallback tiers
    const adReply = {
      title:                 menuData.botName,
      body:                  `${menuData.totalCommands} commands \u2502 ${menuData.uptime}`,
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

    // ── Tier 1: sendButtonsCard (.about style) ─────────────────────────────
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx  = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      bodyText,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands \u2502 ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '\u{1F4CB} All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: aboutCtx,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU orderMessage] Tier 1 (sendButtonsCard) failed, trying sendInteractive:', err.message);
      }
    }

    // ── Tier 2: sendInteractive with image header + subtitle + embedded adReply ──
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
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: orderQuote });
      } catch (err) {
        console.warn('[MENU orderMessage] Tier 2 (sendInteractive + adReply + order) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 3: nativeFlow card with image header ──────────────────────────
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
      console.warn('[MENU orderMessage] Tier 3 (nativeFlow + image) failed, trying plain image:', err.message);
    }

    // ── Tier 4: imageMessage with caption ─────────────────────────────────
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
      console.warn('[MENU orderMessage] Tier 4 (plain image) failed, continuing to text:', err.message);
    }

    // ── Tier 5: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default orderMessageMenu;
