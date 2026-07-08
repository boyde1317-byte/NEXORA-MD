import { buildTextMenu } from '../formatter.js';

export const locationMenu = {
  id: 8,
  name: 'location',
  description: 'Native location card with menu listing',
  supportedMessages: ['locationMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // ── Tier 1: Native location card ─────────────────────────────────────
    try {
      await sock.sendMessage(m.from, {
        location: {
          degreesLatitude:  5.6037,
          degreesLongitude: -0.1870,
          name: menuData.botName || 'NEXORA MD'
        }
      }, { quoted: m });
    } catch (err) {
      console.warn('[MENU location] Location card failed (non-fatal):', err.message);
    }

    // ── Tier 2: Menu text listing (always sent) ───────────────────────────
    return await sock.sendMessage(m.from, {
      text: buildTextMenu(menuData)
    }, { quoted: m });
  }
};

export default locationMenu;
