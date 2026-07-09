import { buildTextMenu } from '../formatter.js';
    import { imageManager } from '../../images/imageManager.js';

    export const productMenu = {
    id: 5,
    name: 'product',
    description: 'Product Catalog/Shop style menu showcase',
    supportedMessages: ['productMessage'],

    renderer: async ({ sock, m, menuData }) => {
      const imgData      = await imageManager.getMenuImage(5);
      const productTitle = `🛒 ${menuData.botName.toUpperCase()} CONSOLE`;
      const caption      = `🛒 *${productTitle}*\n\n` + buildTextMenu(menuData);

      // NOTE: The original Tier 1 used baileysBridge.sendProduct with a hardcoded
      // productId ('bot-service-pack-01') that is never present in any real catalog.
      // The send would either throw immediately or succeed silently and be dropped by
      // the WA client. Removed entirely; image+adReply is now the primary render.

      // ── Tier 1: Image banner with externalAdReply ───────────────────────────────────────────────
      try {
        const adReply = {
          title: productTitle,
          body:  `${menuData.totalCommands} commands • ${menuData.uptime} uptime`,
          sourceUrl: 'https://wa.me/233533416608',
          mediaType: 1, renderLargerThumbnail: true
        };
        if (imgData.source?.startsWith('http')) {
          adReply.thumbnailUrl = imgData.source;
          return await sock.sendMessage(m.from, {
            image: { url: imgData.source }, caption,
            contextInfo: { externalAdReply: adReply }
          }, { quoted: m });
        } else if (imgData.buffer) {
          adReply.thumbnail = imgData.thumbnail;
          return await sock.sendMessage(m.from, {
            image: imgData.buffer, mimetype: imgData.mimetype, caption,
            contextInfo: { externalAdReply: adReply }
          }, { quoted: m });
        }
      } catch (err) {
        console.warn('[MENU product] Tier 1 (image banner) failed, continuing to text:', err.message);
      }

      // ── Tier 2: Guaranteed plain text ─────────────────────────────────────────────────────
      return await sock.sendMessage(m.from, { text: caption }, { quoted: m });
    }
    };

    export default productMenu;
    