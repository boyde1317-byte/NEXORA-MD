import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote } from '../../lib/waUtils.js';
import brand from '../../../config/brand.js';

// Maximum carousel cards sent in a single batch.
const MAX_CAROUSEL_CARDS = 10;

// Category-specific emoji mapping for richer card headers
const CATEGORY_EMOJIS = {
  ai: '', anime: '', download: '', economy: '',
  fun: '', games: '', general: '', group: '',
  media: '', owner: '', utility: '', web: '',
};

/**
 * Carousel Menu (id: 6) \u2014 enhanced for rich-messages.
 *
 * Enhanced card content with:
 *   - Category-specific emoji icons per card header
 *   - Richer caption with command count and top commands preview
 *   - Multiple action buttons per card (category browse + system stats)
 *   - Better footer with card numbering and total commands
 *   - Visual separators and smallcaps labels
 *
 * Tiers:
 *   1 \u2192 native carousel (swipeable category cards \u2014 capped at MAX_CAROUSEL_CARDS)
 *   2 \u2192 nativeFlow category picker (flat buttons, one per category, up to 10)
 *   3 \u2192 guaranteed plain text
 */

// Display name: the styled brand name when the bot runs under the brand
// name, plain otherwise — a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Swipeable category cards rich per-card headers.',
  supportedMessages: ['interactiveMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(6);

    const headerText =
      `${displayName(menuData.botName)} ${toSmallcaps('Carousel Menu')}\n\n` +
      `▰▰▰▰▰▰▰▰▰▰▰\n' +
'_Swipe through the cards to explore._\n' +
'_See what catches your eye and tap to dive in._\n' +
'▰▰▰▰▰▰▰▰▰▰▰`;

    const categories = Object.keys(menuData.categories).sort();

    // ── Tier 1: native carousel ───────────────────────────────────────────
    try {
      const capped = categories.slice(0, MAX_CAROUSEL_CARDS);

      if (categories.length > MAX_CAROUSEL_CARDS) {
        console.warn(
          `[MENU carousel] ${categories.length} categories found \u2014 capped at ${MAX_CAROUSEL_CARDS} cards. ` +
          `Remaining ${categories.length - MAX_CAROUSEL_CARDS} categories omitted to prevent rate-limit bans.`
        );
      }

      const cards = capped.map((cat, idx) => {
        const cmds     = menuData.categories[cat];
        const emoji    = CATEGORY_EMOJIS[cat] || '';
        const cmdList  = cmds.map(c => `${c.name}`).slice(0, 5).join('\n');
        const overflow = cmds.length > 5 ? `\n +${cmds.length - 5} ${toSmallcaps('more')}` : '';

        return {
          caption:   `${emoji} *${toSmallcaps(cat + ' Commands 📃 ')}*\n\n${cmdList}${overflow}\n\n${toSmallcaps('Total')}: ${cmds.length} ${toSmallcaps('commands')}`,
          footer:    `${toSmallcaps('Swipe ➜ ')} ${idx + 1}/${capped.length}`,
          nativeFlow: [
            { text: `${toSmallcaps(cat)}`, id: `${menuData.prefix}help ${cat}` },
            { text: `${toSmallcaps('Stats')}`, id: `${menuData.prefix}ping` },
          ],
          ...(imgData.source?.startsWith('http')
            ? { image: { url: imgData.source } }
            : (imgData.buffer ? { image: imgData.buffer } : {})),
        };
      });

      return await baileysBridge.sendCarousel(sock, m.from, {
        dim:   true,
        text:  headerText,
        cards,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 1 (carousel) failed, trying nativeFlow category buttons:', err.message);
    }

    // ── Tier 2: nativeFlow category picker ───────────────────────────────
    try {
      const catButtons = categories.slice(0, 10).map(cat => {
        const emoji = CATEGORY_EMOJIS[cat] || '';
        return {
          text: `${emoji} ${toSmallcaps(cat)} (${menuData.categories[cat].length})`,
          id:   `${menuData.prefix}help ${cat}`,
        };
      });
      if (catButtons.length === 0) {
        catButtons.push({ text: `\u{1F4CB} ${toSmallcaps('View Menu')}`, id: `${menuData.prefix}menu` });
      }
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        dim: true,
        text:    `${headerText}\n\n` + buildTextMenu(menuData),
        footer:  `${displayName(menuData.botName)} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`,
        title:   '\u{1F3A0} ' + toSmallcaps('COMMAND CATEGORIES'),
        buttons: catButtons,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 2 (nativeFlow) failed, continuing to plain text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + fake quote + banner ────────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.thumbBuffer || undefined });
    const fallbackAdReply = {
      title:                 `✦ ${displayName(menuData.botName)} ✦`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} • ${toSmallcaps('Carousel')}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      fallbackAdReply.thumbnail = imgData.thumbBuffer;
    } else if (imgData.source?.startsWith('http')) {
      fallbackAdReply.thumbnailUrl = imgData.source;
      fallbackAdReply.originalImageUrl = imgData.source;
    }
    return await sock.sendMessage(m.from, {
      text:        `${headerText}\n\n` + buildTextMenu(menuData),
      contextInfo: { externalAdReply: fallbackAdReply },
    }, { quoted: fakeImgQuote });
  },
};

export default carouselMenu;
