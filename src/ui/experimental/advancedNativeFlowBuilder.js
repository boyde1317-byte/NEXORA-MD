import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export const advancedNativeFlowBuilder = {
  validate() {
    return capabilities.nativeFlow;
  },

  build(data) {
    const title = data.title || 'NEXORA MD';
    const footer = data.footer || 'By Aizen';
    const buttons = data.buttons || [];

    return {
      text: data.body || 'Advanced Native Flow',
      footer: footer,
      title: title,
      buttons: buttons.map(btn => ({
        name: btn.name || 'quick_reply',
        params: btn.params || {}
      }))
    };
  },

  fallback: async (sock, jid, data, options = {}) => {
    console.log('[UI ENGINE] Advanced Native Flow unsupported. Falling back to clean standard Interactive layout...');
    const buttons = (data.buttons || []).map(btn => ({
      name: btn.name === 'cta_url' ? 'quick_reply' : btn.name,
      params: {
        display_text: btn.params?.display_text || btn.params?.text || 'Button',
        id: btn.params?.id || btn.params?.url || '.menu'
      }
    }));

    return await baileysBridge.sendInteractive(sock, jid, {
      body: `${data.title}\n\n${data.body || ''}`,
      footer: data.footer,
      buttons: buttons.slice(0, 3) // standard Interactive allows max 3 buttons
    }, options);
  }
};

export default advancedNativeFlowBuilder;
