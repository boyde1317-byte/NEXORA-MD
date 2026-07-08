import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const paymentMenu = {
  id: 2,
  name: 'payment',
  description: 'Premium Request Payment card with menu body note',
  supportedMessages: ['requestPaymentMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically query image selector for style 2
    const imgData = await imageManager.getMenuImage(2);

    // Compile a beautiful invoice header and menu body
    const noteContent = `💳 *AI BOT PREMIUM BILLING*\n\n` + buildTextMenu(menuData);

    // We send an amount of 45.00 USD (represented as 45.00 * 1000 in smallest units)
    // 45 USD * 1000 = 45000
    const paymentParams = {
      amount: 45000, 
      currency: 'USD',
      note: noteContent,
      expiry: Math.floor(Date.now() / 1000) + 86400, // 24 Hours
    };

    return await baileysBridge.sendPayment(sock, m.from, paymentParams, { quoted: m });
  }
};

export default paymentMenu;
