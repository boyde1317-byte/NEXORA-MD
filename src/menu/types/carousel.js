import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildAboutContextInfo, buildAboutButtons, resolveThumbnail } from '../../lib/waUtils.js';
import { buildNavigationButton } from './buttonsCard.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

// Maximum carousel cards sent in a single batch.
const MAX_CAROUSEL_CARDS = 10;

// Category-specific emoji mapping for richer card headers
const CATEGORY_EMOJIS = {
  ai: '🤖', anime: '🎨', download: '📥', economy: '🪙',
  fun: '🎵', games: '🎮', general: '📋', group: '👥',
  media: '🎬', owner: '🔑', utility: '🔧', web: '🌐',
};

/**
 * Carousel Menu (id: 6) — primary tier sendButtonsCard, fallback to swipeable cards.
 *
 * Tiers:
 *   1 → sendButtonsCard (.about command rendering style)
 *   2 → native carousel (swipeable category cards — capped at MAX_CAROUSEL_CARDS)
 *   3 → nativeFlow category picker (flat buttons, one per category, up to 10)
 *   4 → guaranteed plain text
 */
export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Swipeable category cards — rich per-card headers with emoji icons, command previews, and action buttons',
  supportedMessages: ['interactiveMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(6);

    const headerText =
      `🎡 *${toSmallcaps(menuData.botName + ' Carousel Control')}* 🎡\n\n` +
      `${toSmallcaps('Swipe sideways through the cards below to browse command modules:')}\n` +
      `${toSmallcaps('Each card shows top commands — tap to explore more.')}`;

    const categories = Object.keys(menuData.categories).sort();

    const bodyText = `${headerText}\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

    const thumbnail = resolveThumbnail(imgData, ASSET_URLS?.thumbnail);
    const aboutCtx = buildAboutContextInfo({ botName: menuData.botName, description: `${menuData.totalCommands} commands`, thumbnail: imgData?.buffer });

    // ── Tier 1: sendButtonsCard (.about rendering style) ───────────────────
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
        console.warn('[MENU carousel] Tier 1 (sendButtonsCard) failed, trying sendCarousel:', err.message);
      }
    }

    // ── Tier 2: native carousel ───────────────────────────────────────────
    try {
      const capped = categories.slice(0, MAX_CAROUSEL_CARDS);

      if (categories.length > MAX_CAROUSEL_CARDS) {
        console.warn(
          `[MENU carousel] ${categories.length} categories found — capped at ${MAX_CAROUSEL_CARDS} cards. ` +
          `Remaining ${categories.length - MAX_CAROUSEL_CARDS} categories omitted to prevent rate-limit bans.`
        );
      }

      const cards = capped.map((cat, idx) => {
        const cmds     = menuData.categories[cat];
        const emoji    = CATEGORY_EMOJIS[cat] || '📂';
        const cmdList  = cmds.map(c => `• \`${menuData.prefix}${c.name}\``).slice(0, 5).join('\n');
        const overflow = cmds.length > 5 ? `\n  │ +${cmds.length - 5} ${toSmallcaps('more')}` : '';

        return {
          caption:   `${emoji} *${toSmallcaps(cat + ' Command Pack')}*\n\n${cmdList}${overflow}\n\n${toSmallcaps('Total')}: ${cmds.length} ${toSmallcaps('commands')}`,
          footer:    `✦ ${toSmallcaps('Card')} ${idx + 1}/${capped.length} │ ${menuData.botName}`,
          nativeFlow: [
            { text: `⚡ ${cat.toUpperCase()}`, id: `${menuData.prefix}menu ${cat}` },
            { text: `🤖 ${toSmallcaps('Stats')}`, id: `${menuData.prefix}menu aiDynamic` },
          ],
          ...(imgData.source?.startsWith('http')
            ? { image: { url: imgData.source } }
            : (imgData.buffer ? { image: imgData.buffer } : {})),
        };
      });

      return await baileysBridge.sendCarousel(sock, m.from, {
        text:  headerText,
        cards,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 2 (carousel) failed, trying nativeFlow category buttons:', err.message);
    }

    // ── Tier 3: nativeFlow category picker ───────────────────────────────
    try {
      const catButtons = categories.slice(0, 10).map(cat => {
        const emoji = CATEGORY_EMOJIS[cat] || '📂';
        return {
          text: `${emoji} ${cat.toUpperCase()} (${menuData.categories[cat].length})`,
          id:   `${menuData.prefix}menu ${cat}`,
        };
      });
      if (catButtons.length === 0) {
        catButtons.push({ text: '📋 View Menu', id: `${menuData.prefix}menu` });
      }
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    bodyText,
        footer:  `${menuData.botName} │ ${menuData.totalCommands} ${toSmallcaps('commands')}`,
        title:   '🎡 ' + toSmallcaps('COMMAND CATEGORIES'),
        buttons: catButtons,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 3 (nativeFlow) failed, continuing to plain text:', err.message);
    }

    // ── Tier 4: guaranteed plain text + fake quote + banner ────────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${toSmallcaps(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} commands • Carousel`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      fallbackAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: fakeImgQuote });
  },
};

export default carouselMenu;
