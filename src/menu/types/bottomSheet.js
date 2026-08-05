import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { buildAboutContextInfo, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

/**
 * Bottom Sheet Menu (id: 13) — enhanced for rich-messages.
 *
 * Enhanced with:
 *   - Richer body text using stat rows and visual dividers
 *   - More command buttons in the sheet (up to 10)
 *   - Better visual organization with emoji-prefixed commands
 *   - Image header with subtitle via sendInteractive fallback
 *   - Embedded externalAdReply for double visual on fallback tiers
 *
 * Tiers:
 *   1 → sendButtonsCard with thumbnail + catalog quote + navigation buttons
 *   2 → nativeFlow with optionText + image header (triggers native WA bottom sheet)
 *   3 → sendInteractive with image header + subtitle + embedded adReply
 *   4 → nativeFlow without optionText + image header (flat quick-reply buttons)
 *   5 → guaranteed plain text
 */
export const bottomSheetMenu = {
  id: 13,
  name: 'bottomSheet',
  description: 'Bottom sheet modal — optionText on nativeFlow collapses rows into a native WA sheet with rich visuals',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(13);

    // Build richer body text with visual stat rows
    const statBlock = [
      `✦ *${toSmallcaps(menuData.botName + ' Command Center')}* ✦`,
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
    const footerText = footerManager.getFooter() || `${menuData.botName} │ ${toSmallcaps('Bottom Sheet')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // ── Tier 1: sendButtonsCard ───────────────────────────────────────────
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      bodyText,
          footer:    footerText,
          title:     menuData.botName,
          subtitle:  `${menuData.totalCommands} commands • ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '📋 All Commands', id: `${menuData.prefix}menu all`, type: 1 },
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: aboutCtx,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 1 (sendButtonsCard) failed, trying nativeFlow + optionText:', err.message);
      }
    }

    // Build embedded externalAdReply for fallback tiers
    const adReply = {
      title:                 `✦ ${menuData.botName} ✦`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} │ ${toSmallcaps('Bottom Sheet')}`,
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

    // Command rows exposed in the sheet — richer set with emoji prefixes
    const commandButtons = [
      { text: '🏓 Ping Speed',          id: `${menuData.prefix}ping` },
      { text: 'ℹ️ About Bot',           id: `${menuData.prefix}about` },
      { text: '📋 Command List',          id: `${menuData.prefix}menulist` },
      { text: '🤖 System Stats',          id: `${menuData.prefix}menu aiDynamic` },
      { text: '🎨 Set Menu Style',         id: `${menuData.prefix}setmenu` },
      { text: '🏭 Set Footer',            id: `${menuData.prefix}setfooter` },
      { text: '💬 Contact Dev',           url: 'https://wa.me/233533416608' },
    ];

    // ── Tier 2: nativeFlow + optionText + image header ────────────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:        bodyText,
          footer:      footerText,
          image:       imagePayload,
          buttons:     commandButtons,
          optionText:  '📋 ' + toSmallcaps('Browse All Commands'),
          optionTitle: menuData.botName + ' Menu',
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 2 (nativeFlow + optionText + image) failed, trying interactive:', err.message);
      }
    }

    // ── Tier 3: sendInteractive with image header + subtitle + embedded adReply ──
    if (capabilities.interactive && imagePayload) {
      try {
        return await baileysBridge.sendInteractive(sock, m.from, {
          body:    bodyText,
          footer:  footerText,
          header:  {
            title:    `✦ ${toSmallcaps(menuData.botName + ' Menu')} ✦`,
            subtitle: `${toSmallcaps('Quick Access')} │ ${menuData.totalCommands} ${toSmallcaps('commands')}`,
            image:    imagePayload,
          },
          buttons: [
            { name: 'quick_reply', params: { display_text: '🏓 Ping Speed',       id: `${menuData.prefix}ping` } },
            { name: 'quick_reply', params: { display_text: '📋 Command List',     id: `${menuData.prefix}menulist` } },
            { name: 'quick_reply', params: { display_text: '🤖 System Stats',     id: `${menuData.prefix}menu aiDynamic` } },
            { name: 'cta_url',     params: { display_text: '💬 Contact Dev',      url: 'https://wa.me/233533416608' } },
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 3 (sendInteractive + adReply) failed, trying flat nativeFlow:', err.message);
      }
    }

    // ── Tier 4: nativeFlow without optionText + image header ──────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    bodyText,
          footer:  footerText,
          image:   imagePayload,
          buttons: commandButtons.slice(0, 5),
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 4 (flat nativeFlow + image) failed, escalating to text:', err.message);
        throw err; // propagate → runWithFallback → plain text
      }
    }

    // ── Tier 5: nativeFlow unsupported — let runWithFallback render plain text
    throw new Error('bottomSheet: nativeFlow unsupported on this client');
  },
};

export default bottomSheetMenu;
