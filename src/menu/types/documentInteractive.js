import capabilities from '../../core/capabilities.js';
    import { baileysBridge } from '../../core/baileysBridge.js';
    import { buildTextMenu } from '../formatter.js';
    import { imageManager } from '../../images/imageManager.js';

    export const documentInteractiveMenu = {
    id: 1,
    name: 'documentInteractive',
    description: 'Interactive Message with Document Header card',
    supportedMessages: ['interactiveMessage', 'documentMessage'],

    renderer: async ({ sock, m, menuData }) => {
      const imgData    = await imageManager.getMenuImage(1);
      const footerText = `${menuData.botName} • Uptime: ${menuData.uptime}`;
      const caption    = `📂 *${menuData.botName.toUpperCase()} COMMAND CONSOLE*\n\n` + buildTextMenu(menuData);

      const buttons = [
        { name: 'quick_reply', params: { display_text: '💬 Category Menu', id: `${menuData.prefix}menulist` } },
        { name: 'quick_reply', params: { display_text: '⚡ System Info',      id: `${menuData.prefix}menu aiDynamic` } },
        { name: 'quick_reply', params: { display_text: '🏓 Ping Bot',       id: `${menuData.prefix}ping` } }
      ];

      const msgContent = {
        interactiveMessage: {
          body:   { text: buildTextMenu(menuData) },
          footer: { text: footerText },
          header: { title: '📜 Bot Interactive Menu', hasMediaAttachment: false },
          nativeFlowMessage: {
            buttons: buttons.map(btn => ({
              name: btn.name, buttonParamsJson: JSON.stringify(btn.params)
            }))
          }
        }
      };

      // ── Tier 1: Interactive relay ─────────────────────────────────────────────────────────────
      // Gated on both flags: viewOnceMessage+interactiveMessage can succeed silently
      // on clients that don't support the type, leaving the user with no response.
      if (capabilities.interactive && capabilities.nativeFlow) {
        try {
          return await baileysBridge.relayMessage(
            sock, m.from,
            { viewOnceMessage: { message: msgContent } },
            { quoted: m }
          );
        } catch (err) {
          console.warn('[MENU documentInteractive] Tier 1 (interactive relay) failed, trying image:', err.message);
        }
      }

      // ── Tier 2: Image with caption + externalAdReply ─────────────────────────────────────────────
      try {
        const adReply = {
          title: `${menuData.botName} Console`,
          body:  `${menuData.totalCommands} commands • Uptime: ${menuData.uptime}`,
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
          adReply.thumbnail = imgData.thumbnail || imgData.buffer;
          return await sock.sendMessage(m.from, {
            image: imgData.buffer, mimetype: imgData.mimetype, caption,
            contextInfo: { externalAdReply: adReply }
          }, { quoted: m });
        }
      } catch (imgErr) {
        console.warn('[MENU documentInteractive] Tier 2 (image) failed, continuing to text:', imgErr.message);
      }

      // ── Tier 3: Guaranteed plain text ─────────────────────────────────────────────────────
      return await sock.sendMessage(m.from, { text: caption }, { quoted: m });
    }
    };

    export default documentInteractiveMenu;
    