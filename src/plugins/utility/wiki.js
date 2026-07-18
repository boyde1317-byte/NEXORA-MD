import { withReactionStatus } from '../../lib/cosmetics.js';
import { richTableCard } from '../../lib/interactiveKit.js';
import { wikiSearch } from '../../lib/downloader.js';

export default {
  name: 'wiki',
  aliases: ['wikipedia'],
  category: 'utility',
  description: 'Look up a Wikipedia summary. Usage: .wiki <topic>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(
        `Usage: \`${prefix}wiki <topic>\`\n\nExample: \`${prefix}wiki black holes\``,
        'WIKIPEDIA'
      );
    }

    await withReactionStatus(m, async () => {
      const result = await wikiSearch(query);
      await richTableCard(sock, m.from, {
        title: `📖 ${result.title}`,
        rows: [['Summary', result.snippet]],
        footer: 'Source: Wikipedia',
        buttons: [{ kind: 'url', label: '📖 Read Full Article', url: result.url }],
      }, { quoted: m });
    });
  }
};
