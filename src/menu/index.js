import { menuManager } from './manager.js';
import { runWithFallback } from './fallback.js';
import { collectMenuData } from './collector.js';

// Import all 16 menu types
import documentInteractive from './types/documentInteractive.js';
import nativeFlow from './types/nativeFlow.js';
import bottomSheet from './types/bottomSheet.js';
import product from './types/product.js';
import carousel from './types/carousel.js';
import newsletter from './types/newsletter.js';
import location from './types/location.js';
import contact from './types/contact.js';
import orderMessage from './types/orderMessage.js';
import richCard from './types/richCard.js';
import buttonsCard from './types/buttonsCard.js';
import moonsonCard from './types/moonsonCard.js';
import galaxyMenu from './types/galaxyMenu.js';
import commandDirectory from './types/commandDirectory.js';
import a2uiSurface from './types/a2uiSurface.js';
import atlasMenu from './types/atlasMenu.js';
import yonoMenu from './types/yonoMenu.js';
import a2uiWidgetMenu from './types/a2uiWidgetMenu.js';

// Register them all statically in the manager
menuManager.register(documentInteractive);
menuManager.register(nativeFlow);
menuManager.register(bottomSheet);
menuManager.register(product);
menuManager.register(carousel);
menuManager.register(newsletter);
menuManager.register(location);
menuManager.register(contact);
menuManager.register(orderMessage);
menuManager.register(richCard);
menuManager.register(buttonsCard);
menuManager.register(moonsonCard); // legacy alias 'moonsonCard' kept for .setmenu compat
menuManager.menus.set('moonsoncard', moonsonCard);
menuManager.register(galaxyMenu);
menuManager.register(commandDirectory);
menuManager.register(a2uiSurface);
menuManager.register(atlasMenu);
menuManager.register(yonoMenu);
menuManager.register(a2uiWidgetMenu);

/**
 * Compiles the statistics and renders the active menu (or custom specified menu style).
 *
 * @param {object} sock - WASocket active connection
 * @param {object} m - Serialized message trigger context
 * @param {string|number} [customKey] - Optional override style key/id
 */
export const showMenu = async (sock, m, customKey = null) => {
  const menuData = await collectMenuData(sock, m);

  const menu = customKey
    ? menuManager.getMenu(customKey)
    : menuManager.getActiveMenu();

  if (!menu) {
    return await m.reply.error(`Menu style *"${customKey}"* not found. Type \`${menuData.prefix}menulist\` to see valid options.`);
  }

  // Delegate rendering to the fallback engine — single message, no follow-ups
  await runWithFallback(menu.renderer, { sock, m, menuData });
};

export { menuManager, collectMenuData, runWithFallback };
export default showMenu;
