import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildFakeImageQuote, buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Media Menu (id: 10) — .about-style rendering.
 *
 * Primary tier uses sendButtonsCard (thumbnail header + product catalog quote
 * + pill buttons), matching the .about command's visual style.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about style: thumbnail header + catalog quote + pill buttons)
 *   2 → sendInteractive with image header + subtitle + embedded adReply
 *   3 → nativeFlow interactive card with image header + buttons
 *   4 → text + externalAdReply banner
 */
export const mediaMenu = {
  id: 10,
  name: 'media',
  description: 'About-style buttons card with thumbnail header + catalog quote + media dashboard',
  supportedMessages: ['buttonsMessage', 'interactiveMessage', 'nativeFlowMessage', 'imageMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(10);

    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    const footerText = `${menuData.botName} \u2502 ${menuData.totalCommands} commands`;

    const headerBlock = [
      `\u2726 *${toSmallcaps('Media Showcase Dashboard')}* \u2726`,
      '',
      asciiBuilder.statRow('Uptime', menuData.uptime),
      asciiBuilder.statRow('Plugins', menuData.totalCommands),
      asciiBuilder.statRow('Users', menuData.users),
      asciiBuilder.statRow('Prefix', menuData.prefix),
      '',
      asciiBuilder.divider(toSmallcaps('Command Grid')),
      '',
    ].join('\n');

    const caption = headerBlock + buildTextMenu(menuData);

    // Build embedded externalAdReply for fallback tiers
    const adReply = {
      title:                 menuData.botName,
      body:                  `${menuData.totalCommands} commands \u2502 ${menuData.uptime}`,
      sourceUrl:             `https://wa.me/${menuData.ownerNumber || '233597514499'}`,
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
          body:      caption,
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
        console.warn('[MENU media] Tier 1 (sendButtonsCard) failed, trying sendInteractive:', err.message);
      }
    }

    // ── Tier 2: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    caption,
          footer:  footerText,
          header:  {
            title:    `\u2726 ${toSmallcaps('Media Showcase')} \u2726`,
            subtitle: `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Uptime')}: ${menuData.uptime}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'quick_reply', params: { display_text: `\u{1F4CB} ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` } },
            { name: 'cta_url',    params: { display_text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU media] Tier 2 (sendInteractive + adReply) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 3: nativeFlow interactive card with buttons ───────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    caption,
          footer:  footerText,
          image:   imagePayload,
          buttons: [
            { text: `\u{1F4CB} ${toSmallcaps('Browse Menu Styles')}`, id: `${menuData.prefix}menulist` },
            { text: `\u{1F3D1} ${toSmallcaps('Ping Bot')}`,           id: `${menuData.prefix}ping` },
            { text: `\u{1F4AC} ${toSmallcaps('Contact Developer')}`,   url: 'https://wa.me/233533416608' },
          ],
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU media] Tier 3 (nativeFlow) failed, trying adReply:', err.message);
      }
    }

    // ── Tier 4: text + externalAdReply banner ───────────────────────────────
    return await sock.sendMessage(m.from, {
      text: caption,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined }) });
  },
};

export default mediaMenu;
