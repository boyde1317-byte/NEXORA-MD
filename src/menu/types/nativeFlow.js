import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Native Flow Menu (id: 4) — .about-style rendering.
 *
 * Primary tier uses sendButtonsCard (thumbnail header + product catalog quote
 * + pill buttons), matching the .about command's visual style.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + pill buttons)
 *   2 → sendInteractive with image header + subtitle + embedded adReply + mixed buttons
 *   3 → nativeFlow interactive card with image header (simple declarative buttons)
 *   4 → text with externalAdReply banner
 */
export const nativeFlowMenu = {
  id: 4,
  name: 'nativeFlow',
  description: 'About-style buttons card with thumbnail header + catalog quote + navigation',
  supportedMessages: ['buttonsMessage', 'interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(4);
    const bodyText   = `\u26A1 *${toSmallcaps(menuData.botName + ' Menu')}*\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} \u2502 ${toSmallcaps('Native Flow Active')}`;

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply for fallback tiers
    const adReply = {
      title:                 menuData.botName,
      body:                  `${menuData.totalCommands} commands \u2502 ${menuData.prefix}`,
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
        console.warn('[MENU nativeFlow] Tier 1 (sendButtonsCard) failed, trying sendInteractive:', err.message);
      }
    }

    // ── Tier 2: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title:    `\u{1F31F} ${toSmallcaps(menuData.botName)} \u2726`,
            subtitle: `${toSmallcaps('Native Flow')} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'cta_url',    params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,  url: 'https://wa.me/233533416608' } },
            { name: 'cta_url',    params: { display_text: `\u{1F4E1} ${toSmallcaps('Official Channel')}`,   url: 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' } },
            { name: 'cta_copy',   params: { display_text: `\u{1F4CE} ${toSmallcaps('Copy Prefix')}`,        copy: menuData.prefix } },
            { name: 'quick_reply', params: { display_text: `\u{1F916} ${toSmallcaps('System Stats')}`,       id: `${menuData.prefix}menu aiDynamic` } },
            { name: 'quick_reply', params: { display_text: `\u{1F3A8} ${toSmallcaps('Change Menu Style')}`,   id: `${menuData.prefix}menulist` } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU nativeFlow] Tier 2 (sendInteractive + adReply) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 3: nativeFlow buttons with image header ──
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    bodyText,
        footer:  footerText,
        title:   `\u{1F31F} ${toSmallcaps(menuData.botName)} \u2726`,
        image:   imagePayload,
        buttons: [
          { text: '\u{1F4AC} Contact Developer',  url:  'https://wa.me/233533416608' },
          { text: '\u{1F4E1} Official Channel',   url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
          { text: '\u{1F4CE} Copy Prefix',        copy: menuData.prefix },
          { text: '\u{1F916} System Stats',        id:   `${menuData.prefix}menu aiDynamic` },
          { text: '\u{1F3A8} Change Menu Style',   id:   `${menuData.prefix}menulist` },
        ],
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 3 (nativeFlow + image) failed, trying adReply:', err.message);
    }

    // ── Tier 4: text + externalAdReply banner ─────────────────────────────
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined }) });
  },
};

export default nativeFlowMenu;
