import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const paymentMenu = {
  id: 2,
  name: 'payment',
  description: 'Request Payment invoice card styled as a premium bot catalog menu',
  supportedMessages: ['requestPaymentMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(2);

    const noteContent = `💳 *${menuData.botName.toUpperCase()} PREMIUM CONSOLE*\n\n` + buildTextMenu(menuData);

    // ── Tier 1: Native payment card ───────────────────────────────────────
    try {
      return await baileysBridge.sendPayment(sock, m.from, {
        amount:   45000,   // 45.00 USD in smallest units × 1000
        currency: 'USD',
        note:     noteContent,
        expiry:   Math.floor(Date.now() / 1000) + 86400  // 24 h
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU payment] Tier 1 (payment card) failed, trying media banner:', err.message);
    }

    // ── Tier 2: Image banner with externalAdReply ─────────────────────────
    try {
      const adReply = {
        title:                 `${menuData.botName} • Premium Console`,
        body:                  `${menuData.totalCommands} commands • Uptime: ${menuData.uptime}`,
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true
      };

      if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     noteContent,
          contextInfo: { externalAdReply: adReply }
        }, { quoted: m });
      } else if (imgData.buffer) {
        adReply.thumbnail = imgData.thumbnail;
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:     noteContent,
          contextInfo: { externalAdReply: adReply }
        }, { quoted: m });
      }
    } catch (err) {
      console.warn('[MENU payment] Tier 2 (image banner) failed, escalating to text:', err.message);
    }

    // ── Tier 3: Escalate — runWithFallback renders plain text ─────────────
    throw new Error('payment: all render tiers exhausted');
  }
};

export default paymentMenu;
