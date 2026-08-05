import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Document Interactive Menu (id: 1) — .about-style rendering.
 *
 * Primary tier uses sendButtonsCard (thumbnail header + product catalog quote
 * + pill buttons), matching the .about command's visual style.
 * sendInteractive is retained as Tier 2 fallback for richer button types.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + pill buttons)
 *   2 → sendInteractive with image header + subtitle + embedded adReply
 *   3 → nativeFlow interactive card with image header + action buttons
 *   4 → image with caption + externalAdReply banner
 *   5 → guaranteed plain text
 */
export const documentInteractiveMenu = {
  id: 1,
  name: 'documentInteractive',
  description: 'Interactive card — .about-style buttons card with thumbnail header + catalog quote',
  supportedMessages: ['buttonsMessage', 'interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(1);
    const footerText = footerManager.getFooter() || `${menuData.botName} \u2502 Uptime: ${menuData.uptime}`;
    const bodyText   = `\u2726 *${toSmallcaps(menuData.botName)}* \u2726\n\n` + buildTextMenu(menuData);

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build the embedded externalAdReply for fallback tiers
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
        console.warn('[MENU documentInteractive] Tier 1 (sendButtonsCard) failed, trying sendInteractive:', err.message);
      }
    }

    // ── Tier 2: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title:    `\u2726 ${toSmallcaps(menuData.botName + ' Menu')} \u2726`,
            subtitle: `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Uptime')}: ${menuData.uptime}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'quick_reply', params: { display_text: `\u{1F4CB} ${toSmallcaps('Switch Menu Style')}`, id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: `\u26A1 ${toSmallcaps('System Info')}`,        id: `${menuData.prefix}menu aiDynamic` } },
            { name: 'quick_reply', params: { display_text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` } },
            { name: 'cta_url',    params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,  url: 'https://wa.me/233533416608' } },
            { name: 'cta_copy',   params: { display_text: `\u{1F4CE} ${toSmallcaps('Copy Prefix')}`,        copy: menuData.prefix } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU documentInteractive] Tier 2 (sendInteractive + adReply) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 3: nativeFlow interactive card with image header ─────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    bodyText,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: '\u{1F4CB} Switch Menu Style', id: `${menuData.prefix}menulist` },
            { text: '\u26A1 System Info',        id: `${menuData.prefix}menu aiDynamic` },
            { text: '\u{1F3D1} Ping Bot',           id: `${menuData.prefix}ping` },
            { text: '\u{1F4AC} Contact Developer',  url: 'https://wa.me/233533416608' },
            { text: '\u{1F4CE} Copy Prefix',        copy: menuData.prefix },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU documentInteractive] Tier 3 (nativeFlow) failed, trying image banner:', err.message);
      }
    }

    // ── Tier 4: image with caption + externalAdReply ──────────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU documentInteractive] Tier 4 (image banner) failed, falling back to text:', err.message);
    }

    // ── Tier 5: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default documentInteractiveMenu;
