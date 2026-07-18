import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'search',
  category: 'web',
  description: 'Search the web using DuckDuckGo.',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const query = args.join(' ');
    if (!query) return await m.reply.info('Usage: `!search <query>`', 'WEB SEARCH');
    
    try {
      const result = await Providers.search(query);
      
      let text = `🔍 *SEARCH RESULTS: ${query}*\n\n`;
      if (result.AbstractText) {
        text += `${result.AbstractText}\n\n`;
      }
      
      if (result.RelatedTopics && result.RelatedTopics.length > 0) {
        const topics = result.RelatedTopics.slice(0, 5).filter(t => t.Text);
        if (topics.length > 0) {
          text += `*Related:*\n` + topics.map(t => `• ${t.Text}`).join('\n');
        }
      }
      
      if (!result.AbstractText && (!result.RelatedTopics || result.RelatedTopics.length === 0)) {
        text += `No direct abstract found for this query.`;
      }

      await copyResultCard(sock, m.from, {
        text,
        footer: 'Provided by DuckDuckGo',
        copyLabel: '📋 Copy Results',
        copyValue: text
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to fetch search results: ${err.message}`);
    }
  }
};
