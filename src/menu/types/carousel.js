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

      const headerText =
        `🎠 *${menuData.botName.toUpperCase()} CAROUSEL CONTROL* 🎠\n\n` +
        `Swipe sideways through the cards below to view specific command modules:`;

      const categories = Object.keys(menuData.categories).sort();

      const cards = categories.map((cat, idx) => {
        const cmds = menuData.categories[cat];
        const cmdList = cmds.map(c => `• ${menuData.prefix}${c.name}`).slice(0, 5).join('\n');
        const card = {
          body:    `📂 *${cat.toUpperCase()} COMMAND PACK*\n\nManage and execute all ${cat} features:\n${cmdList}\nTotal: ${cmds.length} actions available.`,
          footer:  `Card ${idx + 1} of ${categories.length}`,
          buttons: [{ name: 'quick_reply', params: { display_text: `⚡ Trigger ${cat.toUpperCase()}`, id: `${menuData.prefix}menu` } }]
        };
        if (imgData.buffer) {
          card.image = { url: imgData.buffer, mimetype: imgData.mimetype, jpegThumbnail: imgData.thumbnail };
        }
        return card;
      });

      // ── Tier 1: Native carousel ─────────────────────────────────────────────────────────────────────
      try {
        return await baileysBridge.sendCarousel(sock, m.from, { text: headerText, cards }, { quoted: m });
      } catch (err) {
        console.warn('[MENU carousel] Tier 1 (carousel) failed, trying nativeFlow buttons:', err.message);
      }

      // ── Tier 2: nativeFlow category buttons ─────────────────────────────────────────────────────
      try {
        const catButtons = categories.slice(0, 10).map(cat => ({
          name: 'quick_reply',
          params: { display_text: `📂 ${cat.toUpperCase()} (${menuData.categories[cat].length})`, id: `${menuData.prefix}menu` }
        }));
        if (catButtons.length === 0) {
          catButtons.push({ name: 'quick_reply', params: { display_text: '📋 View Menu', id: `${menuData.prefix}menu` } });
        }
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    `${headerText}\n\n` + buildTextMenu(menuData),
          footer:  `${menuData.botName} • ${menuData.totalCommands} commands`,
          title:   '🎠 COMMAND CATEGORIES',
          buttons: catButtons
        }, { quoted: m });
      } catch (err) {
        console.warn('[MENU carousel] Tier 2 (nativeFlow) failed, continuing to text:', err.message);
      }

      // ── Tier 3: Guaranteed plain text ─────────────────────────────────────────────────────
      return await sock.sendMessage(m.from, {
        text: `${headerText}\n\n` + buildTextMenu(menuData)
      }, { quoted: m });
    }
    };

    export default carouselMenu;
    