import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { bottomSheetBuilder } from '../../ui/experimental/bottomSheetBuilder.js';
import { buildTextMenu } from '../formatter.js';
import { footerManager } from '../../core/footer.js';

export const bottomSheetMenu = {
  id: 5,
  name: 'bottomSheet',
  description: 'Bottom Sheet Interactive Menu with custom category sections and action selector rows',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const textContent = `⚡ *NEXORA MD BOTTOM SHEET INTERACTIVE PANEL*\n\n` + buildTextMenu(menuData);
    const footerText = footerManager.getFooter();

    const sections = [
      {
        title: '⚙️ SYSTEM OPERATIONS',
        highlight: 'Nexora Core',
        rows: [
          { id: `${menuData.prefix}ping`,    title: 'Measure Ping Speed',          description: 'Test system latency and execution speed' },
          { id: `${menuData.prefix}about`,   title: 'About Nexora MD',             description: 'Show framework ownership and active capabilities' },
          { id: `${menuData.prefix}version`, title: 'Version Check',               description: 'Display current build and core engine version' }
        ]
      },
      {
        title: '🎨 PRESENTATION & THEMES',
        highlight: 'Nexora Flow',
        rows: [
          { id: `${menuData.prefix}menulist`,  title: 'Switch Menu Presentation', description: 'Change between the 13 available styles' },
          { id: `${menuData.prefix}setfooter`, title: 'Set Footer Style',         description: 'Configure custom footer signature' }
        ]
      },
      {
        title: '🧪 EXPERIMENTAL DEBUG',
        highlight: 'Nexora Intelligence',
        rows: [
          { id: `${menuData.prefix}testmessage bottomsheet`, title: 'Debug Bottom Sheet',        description: 'Run capability check on Bottom Sheets' },
          { id: `${menuData.prefix}testmessage nativeflow`,  title: 'Debug Native Flow Cards',  description: 'Test multi-action flow button layouts' }
        ]
      }
    ];

    const data = {
      title:       'NEXORA MD PANEL',
      description: textContent,
      footer:      footerText,
      sections
    };

    // ── Tier 1: Native bottomSheet (relay via nativeFlow with bottom_sheet button) ──
    if (capabilities.bottomSheet) {
      try {
        const payload = bottomSheetBuilder.build(data);
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    payload.text,
          footer:  payload.footer,
          title:   data.title,
          buttons: payload.buttons        // [{name:'bottom_sheet', params:{...}}]
        }, { quoted: m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 1 (native bottomSheet) failed, trying nativeFlow:', err.message);
      }
    }

    // ── Tier 2: nativeFlow quick_reply buttons (sections flattened) ──
    if (capabilities.nativeFlow) {
      try {
        return await bottomSheetBuilder.fallback(sock, m.from, data, { quoted: m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 2 (nativeFlow fallback) failed, escalating to text:', err.message);
        throw err;   // runWithFallback will catch → plain text menu
      }
    }

    // Neither supported — let runWithFallback render plain text
    throw new Error('bottomSheet: nativeFlow and bottomSheet both unsupported on this client');
  }
};

export default bottomSheetMenu;
