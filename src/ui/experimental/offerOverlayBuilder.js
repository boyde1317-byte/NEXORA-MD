import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export const offerOverlayBuilder = {
  validate() {
    return capabilities.offerText || capabilities.interactive;
  },

  build(data) {
    const title = data.title || 'NEXORA MD';
    const offer = data.offer || '100% Premium';
    const footer = data.footer || 'By Aizen';

    // Construct interactiveMessage structure containing custom offer overlay fields if supported
    const msgContent = {
      interactiveMessage: {
        body: { text: data.body || 'Nexora Framework Premium Feature' },
        footer: { text: footer },
        header: {
          title: title,
          hasMediaAttachment: false,
          // If the fork supports offerText natively, we attach it
          offerText: offer,
          offerTextMessage: {
            offerText: offer,
            description: data.description || 'Special Developer Edition'
          }
        },
        nativeFlowMessage: {
          buttons: (data.buttons || []).map(btn => ({
            name: btn.name || 'quick_reply',
            buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params || {})
          }))
        }
      }
    };

    return msgContent;
  },

  fallback: async (sock, jid, data, options = {}) => {
    console.log('[UI ENGINE] Offer Overlay unsupported. Falling back to clean Interactive Message...');
    // Fallback to standard sendInteractive with structured text
    const text = `🎉 *${data.title}* 🎉\n\n_${data.offer}_\n\n${data.body || ''}`;
    return await baileysBridge.sendInteractive(sock, jid, {
      body: text,
      footer: data.footer,
      buttons: data.buttons || [
        { name: 'quick_reply', params: { display_text: 'Continue', id: '.menu' } }
      ]
    }, options);
  }
};

export default offerOverlayBuilder;
