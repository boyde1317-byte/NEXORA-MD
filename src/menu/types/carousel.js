import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote } from '../../lib/waUtils.js';
import { buildPillButton, buildPillUrlButton, buildNavigationButton } from './buttonsCard.js';

// Maximum carousel cards sent in a single batch.
const MAX_CAROUSEL_CARDS = 10;

// Category-specific emoji mapping for richer card headers
const CATEGORY_EMOJIS = {
  ai: '\u{1F916}', anime: '\u{1F3A8}', download: '\u{1F4E5}', economy: '\u{1FA9}',
  fun: '\u{1F3B6}', games: '\u{1F3AE}', general: '\u{1F4CB}', group: '\u{1F465}',
  media: '\u{1F3AC}', owner: '\u{1F511}', utility: '\u{1F527}', web: '\u{1F310}',
};

/**
 * Carousel Menu (id: 6) — enhanced for rich-messages.
 *
 * Uses sendButtonsCard (buttonsMessage proto) as Tier 1 for universal
 * WhatsApp client compatibility. The native carousel is retained as
 * Tier 2 for clients that support it.
 *
 * Tiers:
 *   1 → sendButtonsCard with image header + category navigation picker
 *   2 → native carousel (swipeable category cards — capped at MAX_CAROUSEL_CARDS)
 *   3 → guaranteed plain text
 */
export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Pill-button card with category picker + optional swipeable carousel fallback',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(6);

    const headerText =
      `\u{1F3A0} *${toSmallcaps(menuData.botName + ' Carousel Control')}* \u{1F3A0}\n\n` +
      `${toSmallcaps('Tap a category below to browse command modules:')}\n` +
      `${toSmallcaps('Each category shows top commands.')}`;

    const categories = Object.keys(menuData.categories).sort();
    const bodyText = headerText + '\n\n' + buildTextMenu(menuData);
    const footerText = `${menuData.botName} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build embedded externalAdReply
    const adReply = {
      title:                 `\u{1F3A0} ${toSmallcaps(menuData.botName)} \u{1F3A0}`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${categories.length} ${toSmallcaps('categories')}`,
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

    // ── Tier 1: sendButtonsCard with image header + category navigation ────
    if (imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      `\u{1F3A0} ${toSmallcaps('Command Categories')} \u{1F3A0}`,
          subtitle:   `${categories.length} ${toSmallcaps('categories')} \u2502 ${menuData.totalCommands} ${toSmallcaps('commands')}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton('\u{1F916} System Stats',       `${menuData.prefix}menu aiDynamic`),
            buildPillButton('\u{1F3A8} Browse Menu Styles',  `${menuData.prefix}menulist`),
            buildPillUrlButton('\u{1F4AC} Contact Dev',      'https://wa.me/233533416608'),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU carousel] Tier 1 (sendButtonsCard) failed, trying native carousel:', err.message);
      }
    }

    // ── Tier 2: native carousel (swipeable category cards) ────────────────
    try {
      const capped = categories.slice(0, MAX_CAROUSEL_CARDS);

      if (categories.length > MAX_CAROUSEL_CARDS) {
        console.warn(
          `[MENU carousel] ${categories.length} categories found \u2014 capped at ${MAX_CAROUSEL_CARDS} cards.`
        );
      }

      const cards = capped.map((cat, idx) => {
        const cmds     = menuData.categories[cat];
        const emoji    = CATEGORY_EMOJIS[cat] || '\u{1F4C2}';
        const cmdList  = cmds.map(c => `\u2022 \`${menuData.prefix}${c.name}\``).slice(0, 5).join('\n');
        const overflow = cmds.length > 5 ? `\n  \u2502 +${cmds.length - 5} ${toSmallcaps('more')}` : '';

        return {
          caption:   `${emoji} *${toSmallcaps(cat + ' Command Pack')}*\n\n${cmdList}${overflow}\n\n${toSmallcaps('Total')}: ${cmds.length} ${toSmallcaps('commands')}`,
          footer:    `\u2726 ${toSmallcaps('Card')} ${idx + 1}/${capped.length} \u2502 ${menuData.botName}`,
          nativeFlow: [
            { text: `\u26A1 ${cat.toUpperCase()}`, id: `${menuData.prefix}menu` },
            { text: '\u{1F916} Stats', id: `${menuData.prefix}menu aiDynamic` },
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
      console.warn('[MENU carousel] Tier 2 (native carousel) failed, continuing to text:', err.message);
    }

    // ── Tier 3: guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        bodyText,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default carouselMenu;
