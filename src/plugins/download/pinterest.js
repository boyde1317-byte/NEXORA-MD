import { withReactionStatus } from '../../lib/cosmetics.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { pinterestSearch } from '../../lib/downloader.js';

const MAX_RESULTS = 6;

export default {
  name: 'pinterest',
  aliases: ['pin', 'pindl'],
  category: 'download',
  description: 'Searches Pinterest and returns matching images. Usage: .pinterest <search query>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(
        `Usage: \`${prefix}pinterest <search query>\`\n\nExample: \`${prefix}pinterest minimalist wallpaper\``,
        'PINTEREST SEARCH'
      );
    }

    await withReactionStatus(m, async () => {
      const results = (await pinterestSearch(query)).slice(0, MAX_RESULTS);
      const cards = results.map((p, idx) => ({
        caption: `📌 *${(p.title || 'Pinterest Image').slice(0, 80)}*`,
        footer: `Result ${idx + 1} of ${results.length}`,
        nativeFlow: [{ text: '🔗 Open Pin', url: p.pinUrl }],
        image: { url: p.image },
      }));

      try {
        await baileysBridge.sendCarousel(sock, m.from, {
          text: `📌 *Pinterest results for:* "${query}"`,
          cards,
        }, { quoted: m });
      } catch (err) {
        console.warn('[pinterest] carousel failed, sending images individually:', err.message);
        for (const p of results) {
          await sock.sendMessage(m.from, { image: { url: p.image }, caption: p.title || '' }, { quoted: m });
        }
      }
    });
  }
};
