import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const nativeFlowMenu = {
  id: 4,
  name: 'nativeFlow',
  description: 'Advanced Native Flow Buttons, Links, Clipboard Actions, & Category Selectors',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(4);

    const textContent = `⚡ *NATIVE FLOW INTERACTIVE ENGINE*\n\n` + buildTextMenu(menuData);
    const footerText  = `${menuData.botName} • Native Flow Active`;

    const buttons = [
      {
        name:   'cta_url',
        params: {
          display_text:  '💬 Contact Developer',
          url:           'https://wa.me/233533416608',
          merchant_url:  'https://wa.me/233533416608'
        }
      },
      {
        name:   'cta_url',
        params: {
          display_text:  '📢 Official Channel',
          url:           'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326',
          merchant_url:  'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326'
        }
      },
      {
        name:   'cta_copy',
        params: {
          display_text:  '📋 Copy Prefix',
          copy_code:     menuData.prefix
        }
      },
      {
        name:   'quick_reply',
        params: { display_text: '🤖 System Stats',     id: `${menuData.prefix}menu aiDynamic` }
      },
      {
        name:   'quick_reply',
        params: { display_text: '🎨 Change Menu Style', id: `${menuData.prefix}menulist` }
      }
    ];

    // ── Tier 1: Native flow relay ─────────────────────────────────────────
    try {
      return await baileysBridge.sendNativeFlow(sock, m.from, {
        text:    textContent,
        footer:  footerText,
        title:   '🌟 MAIN CONTROL PANEL',
        buttons
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 1 (native flow) failed, trying image+adReply:', err.message);
    }

    // ── Tier 2: Text with externalAdReply banner ──────────────────────────
    try {
      const adReply = {
        title:                 `${menuData.botName} Console`,
        body:                  `${menuData.totalCommands} commands • Prefix: ${menuData.prefix}`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true
      };
      if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
      } else if (imgData.thumbnail) {
        adReply.thumbnail = imgData.thumbnail;
      }

      return await sock.sendMessage(m.from, {
        text:        textContent,
        contextInfo: { externalAdReply: adReply }
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU nativeFlow] Tier 2 (adReply) failed, escalating to text:', err.message);
      throw err;   // runWithFallback → plain text
    }
  }
};

export default nativeFlowMenu;
