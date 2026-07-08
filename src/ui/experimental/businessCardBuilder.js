import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export const businessCardBuilder = {
  validate() {
    return capabilities.interactive || capabilities.nativeFlow;
  },

  build(data) {
    const title = data.title || 'NEXORA MD';
    const footer = data.footer || 'By Aizen';

    // Advanced Business Card using native flow location / contact structure
    const buttons = [
      {
        name: 'send_location',
        params: {}
      }
    ];

    return {
      text: `💼 *BUSINESS CARD* 💼\n\n*Name:* ${data.name || 'Aizen'}\n*Role:* ${data.role || 'Developer'}\n*Project:* ${title}\n*Details:* ${data.details || 'Next-Gen Framework'}`,
      footer: footer,
      buttons: buttons
    };
  },

  fallback: async (sock, jid, data, options = {}) => {
    console.log('[UI ENGINE] Business Card unsupported. Falling back to clean Interactive Text Card...');
    const body = `╭─「 💼 NEXORA BUSINESS 」\n` +
                 `│ Name: ${data.name || 'Aizen'}\n` +
                 `│ Role: ${data.role || 'Developer'}\n` +
                 `│ Project: ${data.title || 'NEXORA MD'}\n` +
                 `│ Info: ${data.details || 'Framework Maintainer'}\n` +
                 `╰─ ${data.footer || 'By Aizen'}`;

    return await baileysBridge.sendMessage(sock, jid, { text: body }, options);
  }
};

export default businessCardBuilder;
