import { menuManager } from './manager.js';
import { runWithFallback } from './fallback.js';
import { collectMenuData } from './collector.js';
import { mediaManager } from '../media/mediaManager.js';

// Import all 12 default menu types
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
    return await m.reply(`❌ Menu style *"${customKey}"* not found. Type \`${menuData.prefix}menulist\` to see valid options.`);
  }

  // Delegate rendering to the fallback engine
  await runWithFallback(menu.renderer, { sock, m, menuData });

  // Sequentially send menu audio message if configured
  try {
    await mediaManager.sendMenuAudio(sock, m.from, m);
  } catch (err) {
    console.error('[MENU ENGINE] Failed to send menu audio:', err);
  }
};

export { menuManager, collectMenuData, runWithFallback };
export default showMenu;
