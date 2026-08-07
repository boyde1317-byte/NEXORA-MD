import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildPillButton, buildPillUrlButton, buildNavigationButton } from './buttonsCard.js';

/**
 * Bottom Sheet Menu (id: 13) — enhanced for rich-messages.
 *
 * Uses sendButtonsCard (buttonsMessage proto) as Tier 1 for universal
 * WhatsApp client compatibility. The single_select category picker works
 * inside buttonsMessage via nativeFlowInfo.
 *
 * Tiers:
 *   1 → sendButtonsCard with image header + subtitle + embedded adReply
 *   2 → imageMessage with caption + externalAdReply
 *   3 → guaranteed plain text
 */
export const bottomSheetMenu = {
  id: 13,
  name: 'bottomSheet',
  description: 'Pill-button card with image header + navigation picker + embedded ad-reply',
  supportedMessages: ['interactiveMessage', 'buttonsMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(13);

    // Build richer body text with visual stat rows
    const statBlock = [
      `\u2726 *${toSmallcaps(menuData.botName + ' Command Center')}* \u2726`,
      '',
      asciiBuilder.statRow('Total Commands', menuData.totalCommands),
      asciiBuilder.statRow('Prefix', menuData.prefix),
      asciiBuilder.statRow('Uptime', menuData.uptime),
      asciiBuilder.statRow('Users', menuData.users),
      '',
      asciiBuilder.divider(toSmallcaps('Commands')),
      '',
    ].join('\n');

    const bodyText   = statBlock + buildTextMenu(menuData);
    const footerText = footerManager.getFooter() || `${menuData.botName} \u2502 ${toSmallcaps('Bottom Sheet')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply
    const adReply = {
      title:                 `\u2726 ${menuData.botName} \u2726`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Bottom Sheet')}`,
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

    // ── Tier 1: sendButtonsCard with image header + subtitle + embedded adReply ──
    if (imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      `\u2726 ${toSmallcaps(menuData.botName + ' Menu')} \u2726`,
          subtitle:   `${toSmallcaps('Quick Access')} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton('\u{1F3D1} Ping Speed',        `${menuData.prefix}ping`),
            buildPillButton('\u2139\uFE0F About Bot',       `${menuData.prefix}about`),
            buildPillButton('\u{1F4CB} Command List',      `${menuData.prefix}menulist`),
            buildPillButton('\u{1F916} System Stats',      `${menuData.prefix}menu aiDynamic`),
            buildPillUrlButton('\u{1F4AC} Contact Dev',    'https://wa.me/233533416608'),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 1 (sendButtonsCard + adReply) failed, trying image:', err.message);
      }
    }

    // ── Tier 2: imageMessage with caption + externalAdReply ────────────────
    try {
      if (imgData.buffer) {
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } else if (imgData.source?.startsWith('http')) {
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:      bodyText,
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      }
    } catch (err) {
      console.warn('[MENU bottomSheet] Tier 2 (image + adReply) failed, continuing to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + banner ────────────────────────────
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: menuData.audioQuote || m });
  },
};

export default bottomSheetMenu;
