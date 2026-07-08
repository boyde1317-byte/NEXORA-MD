import { baileysBridge } from '../../core/baileysBridge.js';
import { imageManager } from '../../images/imageManager.js';

export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Bento carousel cards of categorized commands',
  supportedMessages: ['interactiveMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(6);

    // 1. Core header text
    const headerText = `🎠 *${menuData.botName.toUpperCase()} CAROUSEL CONTROL* 🎠\n\n` +
                       `Swipe sideways through the cards below to view specific command modules:`;

    // 2. Generate a card for each category detected
    const categories = Object.keys(menuData.categories).sort();
    const cards = categories.map((cat, idx) => {
      const cmds = menuData.categories[cat];
      const cmdList = cmds.map(c => `• ${menuData.prefix}${c.name}`).slice(0, 5).join('\n');
      
      const cardPayload = {
        body: `📂 *${cat.toUpperCase()} COMMAND PACK*\n\n` +
              `Manage and execute all ${cat} features:\n${cmdList}\n` +
              `Total: ${cmds.length} actions available.`,
        footer: `Card ${idx + 1} of ${categories.length}`,
        buttons: [
          {
            name: 'quick_reply',
            params: {
              display_text: `⚡ Trigger ${cat.toUpperCase()}`,
              id: `${menuData.prefix}menu` // trigger general help
            }
          }
        ]
      };

      // Apply the dynamic menu image as header to carousel cards if it exists
      if (imgData.buffer) {
        cardPayload.image = {
          mimetype: imgData.mimetype,
          jpegThumbnail: imgData.thumbnail
        };
      }

      return cardPayload;
    });

    // 3. Deliver carousel via our bridge
    return await baileysBridge.sendCarousel(sock, m.from, {
      text: headerText,
      cards: cards
    }, { quoted: m });
  }
};

export default carouselMenu;
