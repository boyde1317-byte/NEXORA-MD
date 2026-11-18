import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildNavigationButton, buildPillButton, buildPillUrlButton, buildPillCopyButton } from './buttonsCard.js';
import brand from '../../../config/brand.js';

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/**
 * Native Flow Menu (id: 4) \u2014 enhanced for rich-messages.
 *
 * Upgraded to use sendInteractive (full proto control) as Tier 1:
 *   - Image header with title AND subtitle
 *   - Embedded externalAdReply inside interactiveMessage.contextInfo
 *     (double visual: interactive card + ad banner in one message)
 *   - Mixed button types: quick_reply, cta_url, cta_copy
 *
 * Tiers:
 *   1 \u2192 sendInteractive with image header + subtitle + embedded adReply + mixed buttons
 *   2 \u2192 nativeFlow interactive card with image header (simple declarative buttons)
 *   3 \u2192 text with externalAdReply banner
 */
export const nativeFlowMenu = {
  id: 4,
  name: 'nativeFlow',
  description: 'Advanced Native Flow \u2014 interactive card.',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(4);
    const bodyText   = `${toSmallcaps('Menu')}\n\n` + buildTextMenu(menuData);
    const footerText = `${toSmallcaps('I am here!🕸')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply for the interactive card
    const adReply = {
      title:                 `${displayName(menuData.botName)}`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Prefix')}: ${menuData.prefix}`,
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

    // ── Tier 1: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          dim: true,
          body:       bodyText,
          footer:     footerText,
          title:      `N E X O R A  M D`,
          subtitle:   `moonson made it ⚡ `,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton(`${toSmallcaps('System Stats')}`,       `${menuData.prefix}ping`),
            buildPillButton(`${toSmallcaps('Change Menu Style')}`,   `${menuData.prefix}menulist`),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU nativeFlow] Tier 1 (sendInteractive + adReply) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 2: nativeFlow buttons with image header (simple declarative) ──
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        dim: true,
        text:    bodyText,
        footer:  footerText,
        title:   `\u{1F31F} ${displayName(menuData.botName)} \u2726`,
        image:   imagePayload,
        buttons: [
          { text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,  url:  'https://wa.me/233533416608' },
          { text: `\u{1F4E1} ${toSmallcaps('Official Channel')}`,   url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
          { text: `\u{1F4CE} ${toSmallcaps('Copy Prefix')}`,        copy: menuData.prefix },
          { text: `\u{1F916} ${toSmallcaps('System Stats')}`,        id:   `${menuData.prefix}menu aiDynamic` },
          { text: `\u{1F3A8} ${toSmallcaps('Change Menu Style')}`,   id:   `${menuData.prefix}menulist` },
        ],
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 2 (nativeFlow + image) failed, trying adReply:', err.message);
    }

    // ── Tier 3: text + externalAdReply banner ─────────────────────────────
    try {
      return await sock.sendMessage(m.from, {
        text:        bodyText,
        contextInfo: { externalAdReply: adReply },
      }, { quoted: buildFakeImageQuote({ jpegThumbnail: imgData.thumbBuffer || undefined }) });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 3 (adReply) failed, escalating to text:', err.message);
      throw err; // runWithFallback → plain text
    }
  },
};

export default nativeFlowMenu;
