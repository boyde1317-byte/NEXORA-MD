import { mixedCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'quote',
  aliases: ['inspire', 'qotd'],
  category: 'fun',
  description: 'Get a random inspirational quote. Usage: .quote',
  cooldown: 5000,
  execute: async ({ sock, m, prefix }) => {
    await withReactionStatus(m, async () => {
      try {
        const res = await fetch('https://dummyjson.com/quotes/random');
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        
        const quoteText = `"${data.quote}"\n\n— *${data.author}*`;
        
        await mixedCard(sock, m.from, {
          text: `✦ *INSPIRATION* ✦\n\n${quoteText}`,
          footer: 'Powered by NEXORA'
        }, [
          { kind: 'copy', label: '📋 Copy Quote', value: data.quote },
          { kind: 'action', label: '🔄 Next Quote', cmd: `${prefix}quote` }
        ], { quoted: m });
      } catch (err) {
        await m.reply.error(`Could not fetch quote: ${err.message}`);
      }
    });
  }
};
