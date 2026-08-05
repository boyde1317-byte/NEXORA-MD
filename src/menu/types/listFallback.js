/**
 * @file src/menu/types/listFallback.js
 *
 * List Fallback Menu (id: 16) — legacy listMessage format.
 *
 * WhatsApp's `listMessage` is the predecessor to `nativeFlow single_select`.
 * It renders as a greyed-out text body with a single "tap to open list" button
 * at the bottom. On older Android builds (pre-2023) that don't support nativeFlow,
 * this is the ONLY way to get a sectioned, tappable menu — otherwise you get
 * blank/broken cards or plain text.
 *
 * Tiers:
 *   1 → sendButtonsCard with thumbnail + catalog quote + navigation buttons
 *   2 → sock.sendMessage with listMessage sections (legacy, works on old clients)
 *   3 → plain text with section headers (guaranteed)
 */

import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import brand from '../../../config/brand.js';
import { imageManager } from '../../images/imageManager.js';
import { buildAboutContextInfo, resolveThumbnail, buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { config } from '../../../config/index.js';

export const listFallbackMenu = {
  id:                 16,
  name:               'listFallback',
  description:        'Legacy listMessage — greyed text body + sectioned row picker. Compatible with all WA client versions.',
  supportedMessages:  ['listMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const p = menuData.prefix || config.prefix?.[0] || '.';

    // ── Build sections from registered command categories ──────────────────
    const categories = menuData.categories || {};
    const catNames   = Object.keys(categories).sort();

    // WA listMessage: max 10 sections, each section max 10 rows (hard limits).
    // We map each category to a section with one row per command (capped at 10).
    const sections = catNames.slice(0, 10).map(cat => ({
      title: cat.charAt(0).toUpperCase() + cat.slice(1),
      rows:  categories[cat].slice(0, 10).map(cmd => ({
        title:       `${p}${cmd.name}`,
        description: cmd.description?.slice(0, 72) || 'No description',
        rowId:       `${p}${cmd.name}`,
      })),
    }));

    // Always append a quick-access "Navigation" section at the end
    sections.push({
      title: 'Quick Access',
      rows: [
        { title: `${p}menu`,   description: 'Show this menu again',   rowId: `${p}menu`   },
        { title: `${p}ping`,   description: 'Check bot latency',      rowId: `${p}ping`   },
        { title: `${p}about`,  description: 'Bot info card',           rowId: `${p}about`  },
        { title: `${p}help`,   description: 'Command guide',           rowId: `${p}help`   },
      ],
    });

    const body =
      `*${brand.name}* — Command Menu\n\n` +
      `› *Uptime:* ${menuData.uptime}\n` +
      `› *Commands:* ${menuData.totalCommands}\n` +
      `› *Users:* ${menuData.users}\n` +
      `› *Groups:* ${menuData.groups}\n` +
      `› *Prefix:* ${p}\n\n` +
      `Tap the button below to browse commands by category.`;

    const footer = `${brand.name} • ${brand.creator}`;

    // ── Tier 1: sendButtonsCard ───────────────────────────────────────────
    let imgData = null;
    try { imgData = await imageManager.getMenuImage(16); } catch (_) {}
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName || brand.name, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });

    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body,
          footer,
          title: menuData.botName || brand.name,
          subtitle: `${menuData.totalCommands} commands • ${menuData.uptime}`,
          thumbnail,
          buttons: [
            { displayText: '📋 All Commands', id: `${p}menu all`, type: 1 },
            buildNavigationButton(p),
          ],
          contextInfo: aboutCtx,
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU listFallback] Tier 1 (sendButtonsCard) failed, trying listMessage:', err.message);
      }
    }

    // ── Tier 2: listMessage (legacy) ───────────────────────────────────────
    try {
      return await sock.sendMessage(m.from, {
        text:       body,
        footer,
        title:      `${brand.name} Menu`,
        buttonText: '📋 Browse Commands',
        sections,
        listType:   1,   // SINGLE_SELECT
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU listFallback] Tier 2 (listMessage) failed, plain text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + fake quote + banner ───────────────
    const fallbackText = buildTextMenu(menuData);
    let fakeImgQuote, fallbackAdReply;
    try {
      fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData?.buffer || undefined });
      fallbackAdReply = {
        title:                 `✦ ${brand.name} ✦`,
        body:                  `${menuData.totalCommands} commands • List Menu`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true,
        showAdAttribution:     false,
      };
      if (imgData?.buffer) {
        fallbackAdReply.thumbnail = imgData.buffer;
      } else if (imgData?.source?.startsWith('http')) {
        fallbackAdReply.thumbnailUrl = imgData.source;
        fallbackAdReply.originalImageUrl = imgData.source;
      }
    } catch (_) {
      fakeImgQuote = m;
    }
    return await sock.sendMessage(m.from, {
      text:        `*${brand.name} Menu*\n\n${fallbackText}`,
      ...(fallbackAdReply ? { contextInfo: { externalAdReply: fallbackAdReply } } : {}),
    }, { quoted: fakeImgQuote || m });
  },
};

export default listFallbackMenu;
