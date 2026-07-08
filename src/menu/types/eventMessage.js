import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const eventMessageMenu = {
  id: 3,
  name: 'eventMessage',
  description: 'Native Event invitation card containing real-time dynamic metadata',
  supportedMessages: ['eventMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(3);

    const eventName = `🎉 ${menuData.botName.toUpperCase()} CONSOLE`;
    const eventDesc = `⚡ Active System Stats:\n• Total Commands: ${menuData.totalCommands}\n• Uptime: ${menuData.uptime}\n• Prefix: ${menuData.prefix}\n• Users Connected: ${menuData.users}`;

    // ── Tier 1: Native eventMessage card ─────────────────────────────────
    try {
      return await baileysBridge.sendEvent(sock, m.from, {
        name:        eventName,
        description: eventDesc,
        minutesAhead: 10,
        joinLink:    'https://wa.me/233533416608'
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU eventMessage] Tier 1 (event card) failed, trying media banner:', err.message);
    }

    // ── Tier 2: Image banner with externalAdReply ─────────────────────────
    try {
      const adReply = {
        title:                 eventName,
        body:                  eventDesc.slice(0, 72),
        sourceUrl:             'https://wa.me/233533416608',
        mediaType:             1,
        renderLargerThumbnail: true
      };
      if (imgData.source?.startsWith('http')) {
        adReply.thumbnailUrl = imgData.source;
        return await sock.sendMessage(m.from, {
          image:       { url: imgData.source },
          caption:     `🎉 *${eventName}*\n\n${eventDesc}\n\n` + buildTextMenu(menuData),
          contextInfo: { externalAdReply: adReply }
        }, { quoted: m });
      } else if (imgData.buffer) {
        adReply.thumbnail = imgData.thumbnail;
        return await sock.sendMessage(m.from, {
          image:       imgData.buffer,
          mimetype:    imgData.mimetype,
          caption:     `🎉 *${eventName}*\n\n${eventDesc}\n\n` + buildTextMenu(menuData),
          contextInfo: { externalAdReply: adReply }
        }, { quoted: m });
      }
    } catch (err) {
      console.warn('[MENU eventMessage] Tier 2 (image banner) failed, escalating to text:', err.message);
    }

    // ── Tier 3: Escalate — runWithFallback renders plain text ─────────────
    throw new Error('eventMessage: all render tiers exhausted');
  }
};

export default eventMessageMenu;
