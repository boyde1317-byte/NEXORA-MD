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

    // Grouping commands into clean sections
    const sections = [
      {
        title: '⚙️ SYSTEM OPERATIONS',
        highlight: 'Nexora Core',
        rows: [
          { id: `${menuData.prefix}ping`, title: 'Measure Ping Speed', description: 'Test system latency and execution speed' },
          { id: `${menuData.prefix}about`, title: 'About Nexora MD', description: 'Show framework ownership and active capabilities' },
          { id: `${menuData.prefix}version`, title: 'Version Check', description: 'Display current build and core engine version' }
        ]
      },
      {
        title: '🎨 PRESENTATION & THEMES',
        highlight: 'Nexora Flow',
        rows: [
          { id: `${menuData.prefix}menulist`, title: 'Switch Menu Presentation', description: 'Change between the 13 available styles' },
          { id: `${menuData.prefix}setfooter`, title: 'Set Footer Style', description: 'Configure custom footer signature' }
        ]
      },
      {
        title: '🧪 EXPERIMENTAL DEBUG',
        highlight: 'Nexora Intelligence',
        rows: [
          { id: `${menuData.prefix}testmessage bottomsheet`, title: 'Debug Bottom Sheet', description: 'Run capability check on Bottom Sheets' },
          { id: `${menuData.prefix}testmessage offer`, title: 'Debug Offer Text Overlay', description: 'Test custom offer graphics overlays' },
          { id: `${menuData.prefix}testmessage nativeflow`, title: 'Debug Native Flow Cards', description: 'Test multi-action flow button layouts' }
        ]
      }
    ];

    const data = {
      title: 'NEXORA MD PANEL',
      description: textContent,
      footer: footerText,
      sections: sections
    };

    if (bottomSheetBuilder.validate()) {
      // Build the message and use baileysBridge to send it
      const payload = bottomSheetBuilder.build(data);
      return await sock.sendMessage(m.from, {
        text: payload.text,
        footer: payload.footer,
        buttons: payload.buttons.map(btn => ({
          name: btn.name,
          buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params)
        }))
      }, { quoted: m });
    } else {
      // Fallback
      return await bottomSheetBuilder.fallback(sock, m.from, data, { quoted: m });
    }
  }
};

export default bottomSheetMenu;
