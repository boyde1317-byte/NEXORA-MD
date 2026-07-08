import { client } from '../core/client.js';

export default {
  name: 'ping',
  aliases: ['p'],
  category: 'general',
  description: 'Measures the response speed of the bot.',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    const start = Date.now();
    const sent = await m.reply('⚡ _Calculating latency..._');
    const latency = Date.now() - start;
    
    // Leverage the edit feature from the serializer helper
    await sock.sendMessage(m.from, {
      text: `🏓 *Pong!* Latency: *${latency}ms*`,
      edit: sent.key
    });
  }
};
