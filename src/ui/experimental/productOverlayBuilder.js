import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export const productOverlayBuilder = {
  validate() {
    return capabilities.interactive;
  },

  build(data) {
    const title = data.title || 'NEXORA MD';
    const footer = data.footer || 'By Aizen';
    const productId = data.productId || 'nexora-1';

    // Construct interactiveMessage with shopMessage / storefront structure
    const msgContent = {
      interactiveMessage: {
        body: { text: data.body || 'Nexora Framework Catalog' },
        footer: { text: footer },
        header: {
          title: title,
          hasMediaAttachment: false
        },
        shopStorefrontMessage: {
          id: productId,
          surface: 1,
          isLive: true
        }
      }
    };

    return msgContent;
  },

  fallback: async (sock, jid, data, options = {}) => {
    console.log('[UI ENGINE] Product Overlay unsupported. Falling back to Product Card...');
    return await baileysBridge.sendProduct(sock, jid, {
      productId: data.productId,
      title: data.title,
      description: data.body,
      currency: 'USD',
      price: data.price || 0,
      footer: data.footer
    }, options);
  }
};

export default productOverlayBuilder;
