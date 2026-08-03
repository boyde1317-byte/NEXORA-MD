import { client } from '../../core/client.js';
import { sendFakeQuote } from '../../lib/waUtils.js';
import { getRandomResponse } from '../../nexora-messages.js';

export default {
  name: 'ping',
  aliases: ['p'],
  category: 'general',
  description: 'Measures the response speed of the bot.',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    const start = Date.now();
    // Fake WhatsApp-branded quote bar gives the "measuring" step a radar-ping feel
    const sent = await sendFakeQuote(sock, m.from, '⚡ _Calculating latency..._', '📡 Ping', { quoted: m });
    const latency = Date.now() - start;

    // Pick a message based on latency tier — adds personality to the number
    let pool;
    if (latency < 100)      pool = 'ping_fast';
    else if (latency < 400) pool = 'ping_normal';
    else                    pool = 'ping_slow';

    const comment = getRandomResponse(pool, latency);

    await sock.sendMessage(m.from, {
      text: comment,
      edit: sent.key
    });
  }
};
