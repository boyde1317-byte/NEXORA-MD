import { buildTextMenu } from '../formatter.js';
import { config } from '../../../config/index.js';
import brand from '../../../config/brand.js';

export const contactMenu = {
  id: 9,
  name: 'contact',
  description: 'Tappable VCard contact card for the bot owner',
  supportedMessages: ['contactMessage', 'contactsArrayMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const ownerNumber = config.owner[0] || '233597514499';
    const ownerName   = menuData.ownerName || brand.creator;

    const cleanNumber = ownerNumber.replace(/[^0-9]/g, '');

    const vcard =
      `BEGIN:VCARD\r\n` +
      `VERSION:3.0\r\n` +
      `FN:${ownerName}\r\n` +
      `TEL;type=CELL;type=VOICE;waid=${cleanNumber}:+${cleanNumber}\r\n` +
      `END:VCARD`;

    // ── Tier 1: vCard contact card ────────────────────────────────────────
    try {
      await sock.sendMessage(m.from, {
        contacts: {
          displayName: ownerName,
          contacts: [{ vcard }]
        }
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU contact] vCard send failed (non-fatal):', err.message);
    }

    // ── Tier 2: Menu text listing (always sent) ───────────────────────────
    return await sock.sendMessage(m.from, {
      text: buildTextMenu(menuData)
    }, { quoted: m });
  }
};

export default contactMenu;
