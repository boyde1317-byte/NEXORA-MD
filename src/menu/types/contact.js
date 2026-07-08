import { buildTextMenu } from '../formatter.js';
import { config } from '../../../config/index.js';
import { imageManager } from '../../images/imageManager.js';
import brand from '../../../config/brand.js';

export const contactMenu = {
  id: 9,
  name: 'contact',
  description: 'Tappable VCard/Contact card for Developer with menu listing',
  supportedMessages: ['contactMessage', 'contactsArrayMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(9);

    const ownerNumber      = config.owner[0] || '233533416608';
    const ownerDisplayName = menuData.ownerName || brand.creator;

    const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${ownerDisplayName}\r\nORG:${brand.name};\r\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\r\nURL:https://wa.me/${ownerNumber}\r\nNOTE:${brand.name} Developer & Administrator\r\nEND:VCARD`;

    // ── Tier 1: vCard contact card ────────────────────────────────────────
    // Wrapped individually — text menu always sends even if vCard fails.
    try {
      await sock.sendMessage(m.from, {
        contacts: {
          displayName: ownerDisplayName,
          contacts: [{ vcard }]
        }
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU contact] vCard send failed (non-fatal), continuing to text:', err.message);
    }

    // ── Tier 2: Menu text listing (always sent) ───────────────────────────
    // This ensures users always receive a response regardless of vCard support.
    return await sock.sendMessage(m.from, {
      text: `📞 *DEVELOPER PROFILE*\n\n` +
            `👤 *Name:* ${ownerDisplayName}\n` +
            `📱 *WhatsApp:* wa.me/${ownerNumber}\n` +
            `✈️ *Telegram:* t.me/DeathCore_Xr\n` +
            `📢 *Channel:* whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326\n\n` +
            buildTextMenu(menuData)
    });
  }
};

export default contactMenu;
