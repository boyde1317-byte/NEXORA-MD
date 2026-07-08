import capabilities from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';

export const bottomSheetBuilder = {
  validate() {
    // Check if bottomSheet or nativeFlow is supported
    return capabilities.bottomSheet || capabilities.nativeFlow;
  },

  build(data) {
    const title = data.title || 'NEXORA MD';
    const footer = data.footer || 'By Aizen';
    const sections = data.sections || [];

    // Map sections into WhatsApp native flow button params
    const buttons = [
      {
        name: 'bottom_sheet',
        params: {
          title: title,
          description: data.description || 'Bottom Sheet Menu',
          sections: sections.map(sec => ({
            title: sec.title || '',
            highlight_label: sec.highlight || '',
            rows: (sec.rows || []).map(row => ({
              header: row.header || '',
              title: row.title || '',
              description: row.description || '',
              id: row.id || ''
            }))
          }))
        }
      }
    ];

    return {
      text: title,
      footer: footer,
      buttons
    };
  },

  fallback: async (sock, jid, data, options = {}) => {
    console.log('[UI ENGINE] Bottom Sheet unsupported. Falling back to Native Flow...');
    // Fallback to Native Flow Buttons
    const buttons = [];
    if (data.sections) {
      data.sections.forEach(sec => {
        if (sec.rows) {
          sec.rows.forEach(row => {
            buttons.push({
              name: 'quick_reply',
              params: {
                display_text: row.title,
                id: row.id
              }
            });
          });
        }
      });
    }

    if (buttons.length === 0) {
      buttons.push({
        name: 'quick_reply',
        params: { display_text: 'Open Menu', id: '.menu' }
      });
    }

    // Limit to max 10 buttons for standard nativeFlow
    const finalButtons = buttons.slice(0, 10);

    return await baileysBridge.sendNativeFlow(sock, jid, {
      text: `${data.title}\n\n${data.description || ''}`,
      footer: data.footer,
      buttons: finalButtons
    }, options);
  }
};

export default bottomSheetBuilder;
