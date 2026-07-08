import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const locationMenu = {
  id: 8,
  name: 'location',
  description: 'Interactive Location card at Googleplex HQ with menu caption',
  supportedMessages: ['locationMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically query image selector for style 8
    const imgData = await imageManager.getMenuImage(8);

    // 1. Send the native location card
    await sock.sendMessage(m.from, {
      location: {
        degreesLatitude: 37.4220,
        degreesLongitude: -122.0841,
        name: `📍 ${menuData.botName.toUpperCase()} DEV HQ`,
        address: `1600 Amphitheatre Pkwy, Mountain View, CA 94043 • Active Console`
      }
    }, { quoted: m });

    // 2. Deliver the formatted menu list as a companion message immediately after
    return await sock.sendMessage(m.from, {
      text: `🗺️ *CONSOLE GEOLOCATION ESTABLISHED*\n\n` + buildTextMenu(menuData)
    });
  }
};

export default locationMenu;
