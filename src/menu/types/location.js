import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const locationMenu = {
  id: 8,
  name: 'location',
  description: 'Interactive Location card at Googleplex HQ with menu caption',
  supportedMessages: ['locationMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData = await imageManager.getMenuImage(8);

    // ── Tier 1: Native location card ─────────────────────────────────────
    // Wrapped individually — menu text always sends even if location fails.
    try {
      await sock.sendMessage(m.from, {
        location: {
          degreesLatitude:  37.4220,
          degreesLongitude: -122.0841,
          name:    `📍 ${menuData.botName.toUpperCase()} DEV HQ`,
          address: `1600 Amphitheatre Pkwy, Mountain View, CA 94043 • Active Console`
        }
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU location] Location card failed (non-fatal), continuing to text:', err.message);
    }

    // ── Tier 2: Menu text listing (always sent) ───────────────────────────
    return await sock.sendMessage(m.from, {
      text: `🗺️ *CONSOLE GEOLOCATION ESTABLISHED*\n\n` + buildTextMenu(menuData)
    });
  }
};

export default locationMenu;
