import capabilities from '../../core/capabilities.js';
    import { baileysBridge } from '../../core/baileysBridge.js';
    import { buildTextMenu } from '../formatter.js';
    import { imageManager } from '../../images/imageManager.js';

    export const paymentMenu = {
    id: 2,
    name: 'payment',
    description: 'Request Payment invoice card styled as a premium bot catalog menu',
    supportedMessages: ['requestPaymentMessage'],

    renderer: async ({ sock, m, menuData }) => {
      const imgData     = await imageManager.getMenuImage(2);
      const noteContent = `💳 *${menuData.botName.toUpperCase()} PREMIUM CONSOLE*\n\n` + buildTextMenu(menuData);

      // ── Tier 1: Native payment card ───────────────────────────────────────────────────
      // Without a capability gate, sendPayment succeeds at the network level but
      // WhatsApp clients silently discard the message on non-merchant accounts,
      // so Tier 2 is never reached and the user gets no response.
      if (capabilities.requestPayment) {
        try {
          return await baileysBridge.sendPayment(sock, m.from, {
            amount:   45000,
            currency: 'USD',
            note:     noteContent,
            expiry:   Math.floor(Date.now() / 1000) + 86400
          }, { quoted: m });
        } catch (err) {
          console.warn('[MENU payment] Tier 1 (payment card) failed:', err.message);
        }
      }

      // ── Tier 2: Guaranteed plain text ────────────────────────────────────────────────────
      return await sock.sendMessage(m.from, { text: noteContent }, { quoted: m });
    }
    };

    export default paymentMenu;
    