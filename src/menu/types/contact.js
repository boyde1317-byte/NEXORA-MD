import { buildTextMenu } from '../formatter.js';
import { config } from '../../../config/index.js';
import { imageManager } from '../../images/imageManager.js';

export const contactMenu = {
  id: 9,
  name: 'contact',
  description: 'Tappable VCard/Contact card for Developer with menu listing',
  supportedMessages: ['contactMessage', 'contactsArrayMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(9);

    const ownerNumber = config.owner[0] || '1234567890';
    const ownerDisplayName = menuData.ownerName || 'AI Studio Owner';

    // 1. Compile a premium vCard payload conforming to standard specifications
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${ownerDisplayName}
ORG:Google AI Studio Bot Architect;
TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}
EMAIL;type=INTERNET:sixthreplit@gmail.com
NOTE:Official Bot Maintainer and Administrator Console
END:VCARD`;

    // 2. Send the contact card first
    await sock.sendMessage(m.from, {
      contacts: {
        displayName: ownerDisplayName,
        contacts: [{ vcard }]
      }
    }, { quoted: m });

    // 3. Send the menu listing as the contact context
    return await sock.sendMessage(m.from, {
      text: `📞 *DEVELOPER PROFILE RETRIEVED*\n\n` + buildTextMenu(menuData)
    });
  }
};

export default contactMenu;
