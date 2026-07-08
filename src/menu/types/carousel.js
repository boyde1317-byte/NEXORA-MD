import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const carouselMenu = {
  id: 6,
  name: 'carousel',
  description: 'Bento carousel cards of categorized commands',
  supportedMessages: ['interactiveMessage', 'carouselMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(6);

    const headerText = `🎠 *${menuData.botName.toUpperCase()} CAROUSEL CONTROL* 🎠\n\n` +
                       `Swipe sideways through the cards below to view specific command modules:`;

    const categories = Object.keys(menuData.categories).sort();

    const cards = categories.map((cat, idx) => {
      const cmds = menuData.categories[cat];
      const cmdList = cmds.map(c => `• ${menuData.prefix}${c.name}`).slice(0, 5).join('\n');
      const cardPayload = {
        body:   `📂 *${cat.toUpperCase()} COMMAND PACK*\n\n` +
                `Manage and execute all ${cat} features:\n${cmdList}\n` +
                `Total: ${cmds.length} actions available.`,
        footer: `Card ${idx + 1} of ${categories.length}`,
        buttons: [
          { name: 'quick_reply', params: { display_text: `⚡ Trigger ${cat.toUpperCase()}`, id: `${menuData.prefix}menu` } }
        ]
      };
      // image must carry the actual buffer so sendCarousel can build a real imageMessage
      if (imgData.buffer) {
        cardPayload.image = { url: imgData.buffer, mimetype: imgData.mimetype, jpegThumbnail: imgData.thumbnail };
      }
      return cardPayload;
    });

    // ── Tier 1: Native carousel ────────────────────────────────────────────
    try {
      return await baileysBridge.sendCarousel(sock, m.from, { text: headerText, cards }, { quoted: m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 1 (carousel) failed, trying nativeFlow buttons:', err.message);
    }

    // ── Tier 2: nativeFlow category buttons ───────────────────────────────
    try {
      const catButtons = categories.slice(0, 10).map(cat => ({
        name:   'quick_reply',
        params: { display_text: `📂 ${cat.toUpperCase()} (${menuData.categories[cat].length})`, id: `${menuData.prefix}menu` }
      }));
      if (catButtons.length === 0) {
        catButtons.push({ name: 'quick_reply', params: { display_text: '📋 View Menu', id: `${menuData.prefix}menu` } });
      }

      const footerText = `${menuData.botName} • ${menuData.totalCommands} commands`;

      // Attach image if available
      let header;
      if (imgData.buffer || imgData.source?.startsWith('http')) {
        header = imgData.source?.startsWith('http')
          ? { title: `🎠 ${menuData.botName}`, hasMediaAttachment: false }
          : undefined;
      }

      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    `${headerText}\n\n` + buildTextMenu(menuData),
        footer:  footerText,
        title:   `🎠 COMMAND CATEGORIES`,
        buttons: catButtons
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU carousel] Tier 2 (nativeFlow) failed, escalating to text:', err.message);
      throw err;   // runWithFallback → plain text
    }
  }
};

export default carouselMenu;
