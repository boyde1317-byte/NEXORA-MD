import { client } from '../../core/client.js';
import { sendFakeQuote } from '../../lib/waUtils.js';

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

    // Leverage the edit feature from the serializer helper
    await sock.sendMessage(m.from, {
      text: `🏓 *Pong!* Latency: *${latency}ms*`,
      edit: sent.key
    });
  }
};
