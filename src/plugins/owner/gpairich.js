/**
 * gpairich.js — .gpairich — fixed AIRich demo card for the owner.
 *
 * Ported from luna-md/plugins/gpairich.js. The hardcoded old-owner
 * number is replaced with moonson's 233533416608.
 * AIRich comes from the shared NX lib (../../lib/NIXCODE.js); that
 * class has no addMetadata, so the footer line is set with setFooter
 * instead. The LUNA original was explicitly NOT owner-gated
 * (handler.owner = false) — it is a demo card showing the owner's
 * contact — so no permissions gate is added here either.
 * The relay fallback is kept, rebranded to NEXORA MD.
 */

import { AIRich } from '../../lib/NIXCODE.js';

const OWNER_NUMBER = '233533416608';

export default {
  name: 'gpairich',
  aliases: [],
  category: 'owner',
  description: 'Show the fixed AIRich demo card for the NEXORA MD owner.',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    try {
      await new AIRich(sock)
        .addText('👑 Owner of NEXORA MD\n\nThis is an AIRich table running on NIXCODE')
        .setFooter(`© NEXORA MD • MOONSON • 2026\n${OWNER_NUMBER}`)
        .addSuggest([OWNER_NUMBER])
        .send(m.from, { quoted: m });
    } catch (e) {
      // If NIXCODE does not work, send normally
      await sock.sendMessage(m.from, { text: `AIRich Error: ${e.message}\n\nTry a normal relay:\n` }, { quoted: m });
      await sock.relayMessage(m.from, {
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              submessages: [{ messageType: 2, messageText: 'Owner of NEXORA MD' }],
              messageType: 1,
              unifiedResponse: { data: Buffer.from(JSON.stringify({ response_id: 'gpairich-nexora' })).toString('base64') },
            },
          },
        },
      }, {});
    }
  },
};
