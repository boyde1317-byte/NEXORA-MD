import { menuManager } from './manager.js';
import { runWithFallback } from './fallback.js';
import { collectMenuData } from './collector.js';
import { mediaManager } from '../media/mediaManager.js';
import { buildFakeLiveLocationQuote } from '../lib/waUtils.js';
import { actionCard } from '../lib/interactiveKit.js';
import { db } from '../database/db.js';
import { imageManager } from '../images/imageManager.js';

// Import all 15 menu types
import documentInteractive from './types/documentInteractive.js';
import payment from './types/payment.js';
import eventMessage from './types/eventMessage.js';
import nativeFlow from './types/nativeFlow.js';
import bottomSheet from './types/bottomSheet.js';
import product from './types/product.js';
import carousel from './types/carousel.js';
import newsletter from './types/newsletter.js';
import location from './types/location.js';
import contact from './types/contact.js';
import media from './types/media.js';
import reaction from './types/reaction.js';
import aiDynamic from './types/aiDynamic.js';
import orderMessage from './types/orderMessage.js';
import richCard from './types/richCard.js';
import buttonsCard from './types/buttonsCard.js';

// Register them all statically in the manager
menuManager.register(documentInteractive);
menuManager.register(payment);
menuManager.register(eventMessage);
menuManager.register(nativeFlow);
menuManager.register(bottomSheet);
menuManager.register(product);
menuManager.register(carousel);
menuManager.register(newsletter);
menuManager.register(location);
menuManager.register(contact);
menuManager.register(media);
menuManager.register(reaction);
menuManager.register(aiDynamic);
menuManager.register(orderMessage);
menuManager.register(richCard);
menuManager.register(buttonsCard);

/**
 * Compiles the statistics and renders the active menu (or custom specified menu style).
 * 
 * @param {object} sock - WASocket active connection
 * @param {object} m - Serialized message trigger context
 * @param {string|number} [customKey] - Optional override style key/id
 */
export const showMenu = async (sock, m, customKey = null) => {
  const menuData = collectMenuData(sock);
  
  const menu = customKey 
    ? menuManager.getMenu(customKey) 
    : menuManager.getActiveMenu();

  if (!menu) {
    return await m.reply.error(`Menu style *"${customKey}"* not found. Type \`${menuData.prefix}menulist\` to see valid options.`);
  }

  // Delegate rendering to the fallback engine
  await runWithFallback(menu.renderer, { sock, m, menuData });

  // ── Follow-up: quick-access buttons after the menu card ──────────────
  // Gives users a one-tap path to help, daily rewards, and ping from the
  // menu — no need to type anything. Skipped when previewing a custom style
  // (the style-preview buttons below are more relevant in that context).
  if (!customKey) {
    try {
      const p = menuData.prefix || '.';
      await actionCard(sock, m.from, {
        text:   `That's the overview. Want to go deeper? Tap below \u2014 I've got you. \u2726`,
        footer: `${menuData.botName} \u2502 ${menuData.totalCommands} commands`,
      }, [
        { label: '\u{1F4D6} Command Guide',   cmd: `${p}help` },
        { label: '\u{1FA9} Claim Daily',     cmd: `${p}daily` },
        { label: '\u{1F3D1} Ping Bot',        cmd: `${p}ping` },
      ], { quoted: m });
    } catch (_) {}
  }

  // If the user is previewing a non-default style, offer a one-tap button to
  // set it as the default so they don't have to separately run .setmenu.
  const activeMenu = menuManager.getActiveMenu();
  if (customKey && activeMenu && String(activeMenu.id) !== String(menu.id)) {
    try {
      const p = menuData.prefix || '.';
      await actionCard(sock, m.from, {
        text:   `\u{1F441}\uFE0F You're previewing *${menu.name}*.\nLike what you see? Make it permanent \u2014 one tap below.`,
        footer: `Currently active: ${activeMenu.name}`,
      }, [
        { label: `\u2705 Set as Default`, cmd: `${p}setmenu ${menu.id}` },
        { label: `\u{1F441}\uFE0F View Another Style`, cmd: `${p}menulist` },
      ], { quoted: m });
    } catch (_) {}
  }

  // Send the actual audio as a real message after the menu card.
  // Quote it with a fake order card showing bot name + command count so the
  // audio message displays the product-catalog style header (\u{1F6D2} X items, bot name).
  // Skip audio in group chats — it plays out loud for everyone and is intrusive.
  // Users in DMs still get the full audio experience.
  const isGroupChat = m.from?.endsWith('@g.us');
  if (!isGroupChat) {
    try {
      let audioCtx = m;
      try {
        const activeId = menuManager.getActiveMenu()?.id || 1;
        const imgData  = await imageManager.getMenuImage(activeId);
        audioCtx = buildFakeLiveLocationQuote({
          caption:       `${menuData.botName.toUpperCase()} \u2502 ${menuData.totalCommands} commands`,
          jpegThumbnail: imgData.buffer,
        });
      } catch (qErr) {
        console.warn('[MENU ENGINE] Could not build order quote for audio, using m:', qErr.message);
      }
      await mediaManager.sendMenuAudio(sock, m.from, audioCtx);
    } catch (err) {
      console.error('[MENU ENGINE] Failed to send menu audio:', err);
    }
  }
};

export { menuManager, collectMenuData, runWithFallback };
export default showMenu;
