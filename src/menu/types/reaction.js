import { buildCompactMenu } from '../formatter.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { imageManager } from '../../images/imageManager.js';
import { buildAboutContextInfo, resolveThumbnail, buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

export const reactionMenu = {
  id: 11,
  name: 'reaction',
  description: 'Ultra-lightweight reaction-triggered and live-edited inline menu',
  supportedMessages: ['react', 'edit'],

  renderer: async ({ sock, m, menuData }) => {
    // Pre-fetch image for thumbnail/externalAdReply banner.
    const imgData = await imageManager.getMenuImage(11);

    // 1. React with a loading emoji (non-critical — ignore failure)
    try { await m.react('⏳'); } catch (_) {}

    // 2. Build final menu text & footer
    const finalMenuText = buildCompactMenu(menuData);
    const footerText = `${menuData.botName} • ${toSmallcaps('Reaction Menu')}`;

    // ── Tier 1: sendButtonsCard ───────────────────────────────────────────
    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });

    if (capabilities.nativeFlow) {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        try { await m.react('✅'); } catch (_) {}
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:      finalMenuText,
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
        console.warn('[MENU reaction] Tier 1 (sendButtonsCard) failed, trying react+edit:', err.message);
      }
    }

    // ── Tier 2: Live-edit loading message (OLD Tier 1) ────────────────────
    const adReply = {
      title:                 `✦ ${toSmallcaps(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
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

    const hasImage = !!(imgData.buffer || imgData.source?.startsWith('http'));

    const loadingMsg = await sock.sendMessage(m.from, {
      text: `✦ *${toSmallcaps(menuData.botName)}* ✦\n\n⏳ _${toSmallcaps('Synchronizing plugins and command directories')}..._`,
      ...(hasImage ? { contextInfo: { externalAdReply: adReply } } : {}),
    }, { quoted: menuData.audioQuote || m });

    await new Promise(resolve => setTimeout(resolve, 1200));

    try { await m.react('✅'); } catch (_) {}

    if (loadingMsg?.key) {
      try {
        return await sock.sendMessage(m.from, {
          text: finalMenuText,
          edit: loadingMsg.key,
        });
      } catch (editErr) {
        console.warn('[MENU reaction] Tier 2 (live-edit) failed on this client, sending new message:', editErr.message);
        try {
          await sock.sendMessage(m.from, { delete: loadingMsg.key });
        } catch (_) {}
      }
    }

    // ── Tier 3: Send as a fresh message (edit unsupported) ────────────────
    return await sock.sendMessage(m.from, {
      text: finalMenuText,
      ...(hasImage ? { contextInfo: { externalAdReply: adReply } } : {}),
    }, { quoted: buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined }) });
  }
};

export default reactionMenu;
