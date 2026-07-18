import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

// Maximum carousel cards sent in a single batch.
// The fork relays each card individually with a 1500ms inter-card delay
// (hardcoded in messages-send.js). Sending too many cards in quick succession
// risks a WA rate-limit ban. Excess categories fall back to Tier 2's flat
// nativeFlow category picker instead.
const MAX_CAROUSEL_CARDS = 10;

/**
 * Carousel Menu (id: 6) — rewritten for itsliaaa 0.3.18-final fork.
 *
 * Uses the fork's carousel API:
 *   sock.sendMessage(jid, { carousel: { cards: [...] }, text })
 *
 * Card shape (fork handles per-card upload + proto assembly):
 *   {
 *     caption:    '...',           // body text — use `caption`, NOT `text`, for image cards
 *     footer:     '...',
 *     nativeFlow: [{ text, id }],  // fork's declarative button format
 *     image:      Buffer | {url},  // fork auto-uploads this
 *   }
 *
 * NOTE on `delayMs`:
 *   The fork's album loop in messages-send.js uses a hardcoded 1500ms inter-card
 *   delay. There is no external override for this value — it is set by the fork,
 *   not by the caller. Keep MAX_CAROUSEL_CARDS ≤ 10 to stay within WA rate limits.
 *
 * Tiers:
 *   1 → native carousel (swipeable category cards — capped at MAX_CAROUSEL_CARDS)
 *   2 → nativeFlow category picker (flat buttons, one per category, up to 10)
 *   3 → guaranteed plain text
 */
export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Swipeable category cards — one card per command module with image header',
  supportedMessages: ['interactiveMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(6);

    const headerText =
      `🎠 *${menuData.botName.toUpperCase()} CAROUSEL CONTROL* 🎠\n\n` +
      `Swipe sideways through the cards below to browse command modules:`;

    const categories = Object.keys(menuData.categories).sort();

    // ── Tier 1: native carousel ───────────────────────────────────────────
    // Each card: image header + category command list as caption + quick-reply button.
    // Fork uses `caption` (not `text`) for the body on image/media carousel cards.
    // Capped at MAX_CAROUSEL_CARDS to avoid rate-limit bans (fork relays each
    // card individually with a fixed 1500ms inter-card delay).
    try {
      const capped = categories.slice(0, MAX_CAROUSEL_CARDS);

      if (categories.length > MAX_CAROUSEL_CARDS) {
        console.warn(
          `[MENU carousel] ${categories.length} categories found — capped at ${MAX_CAROUSEL_CARDS} cards. ` +
          `Remaining ${categories.length - MAX_CAROUSEL_CARDS} categories omitted to prevent rate-limit bans.`
        );
      }

      const cards = capped.map((cat, idx) => {
        const cmds    = menuData.categories[cat];
        const cmdList = cmds.map(c => `• ${menuData.prefix}${c.name}`).slice(0, 5).join('\n');
        const overflow = cmds.length > 5 ? `\n  _+ ${cmds.length - 5} more_` : '';
        return {
          caption:   `📂 *${cat.toUpperCase()} COMMAND PACK*\n\n${cmdList}${overflow}\n\nTotal: ${cmds.length} commands`,
          footer:    `Card ${idx + 1} of ${capped.length}`,
          nativeFlow: [
            { text: `⚡ ${cat.toUpperCase()}`, id: `${menuData.prefix}menu` },
          ],
          // Resolve image payload: prefer the { url } form — WA fetches it
          // directly, no local buffer download/re-upload round trip. Buffer
          // is only a fallback for local disk images with no public URL.
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
      console.warn('[MENU carousel] Tier 1 (carousel) failed, trying nativeFlow category buttons:', err.message);
    }

    // ── Tier 2: nativeFlow category picker ───────────────────────────────
    try {
      const catButtons = categories.slice(0, 10).map(cat => ({
        text: `📂 ${cat.toUpperCase()} (${menuData.categories[cat].length})`,
        id:   `${menuData.prefix}menu`,
      }));
      if (catButtons.length === 0) {
        catButtons.push({ text: '📋 View Menu', id: `${menuData.prefix}menu` });
      }
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    `${headerText}\n\n` + buildTextMenu(menuData),
        footer:  `${menuData.botName} • ${menuData.totalCommands} commands`,
        title:   '🎠 COMMAND CATEGORIES',
        buttons: catButtons,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 2 (nativeFlow) failed, continuing to plain text:', err.message);
    }

    // ── Tier 3: guaranteed plain text ─────────────────────────────────────
    return await sock.sendMessage(m.from, {
      text: `${headerText}\n\n` + buildTextMenu(menuData),
    }, { quoted: menuData.audioQuote || m });
  },
};

export default carouselMenu;
