import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const nativeFlowMenu = {
  id: 4,
  name: 'nativeFlow',
  description: 'Advanced Native Flow Buttons, Links, Clipboard Actions, & Category Selectors',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(4);

    // 1. Core menu text
    const textContent = `⚡ *NATIVE FLOW INTERACTIVE ENGINE*\n\n` + buildTextMenu(menuData);
    const footerText = `${menuData.botName} • Native Flow Active`;

    // 2. High-fidelity Native Flow Buttons list
    const buttons = [
      {
        name: 'cta_url',
        params: {
          display_text: '🌐 Developer Workspace',
          url: 'https://ai.studio/build',
          merchant_url: 'https://ai.studio/build'
        }
      },
      {
        name: 'cta_copy',
        params: {
          display_text: '📋 Copy Prefix',
          copy_code: menuData.prefix
        }
      },
      {
        name: 'quick_reply',
        params: {
          display_text: '🤖 System Stats',
          id: `${menuData.prefix}menu aiDynamic`
        }
      },
      {
        name: 'quick_reply',
        params: {
          display_text: '🎨 Change Menu Style',
          id: `${menuData.prefix}menulist`
        }
      }
    ];

    return await baileysBridge.sendNativeFlow(sock, m.from, {
      text: textContent,
      footer: footerText,
      title: '🌟 MAIN CONTROL PANEL',
      buttons: buttons
    }, { quoted: m });
  }
};

export default nativeFlowMenu;
