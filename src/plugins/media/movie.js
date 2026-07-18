import { Providers, webClient } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'movie',
  aliases: ['imdb', 'omdb'],
  category: 'media',
  description: 'Lookup movie or series information.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(`Usage: \`${prefix}movie <title>\``, 'MOVIE LOOKUP');
    }

    try {
      const apiKey = process.env.OMDB_API_KEY;
      if (!apiKey) return await m.reply.error('OMDB_API_KEY is not configured in .env');

      const url = `http://www.omdbapi.com/?t=${encodeURIComponent(query)}&apikey=${apiKey}`;
      const { data } = await webClient.fetch(url, { useCache: true });

      if (data.Response === 'False') {
        throw new Error(data.Error);
      }

      const text = `🎬 *${data.Title} (${data.Year})*\n\n` +
        `*Rating:* ⭐ ${data.imdbRating} | ⏱️ ${data.Runtime}\n` +
        `*Genre:* ${data.Genre}\n` +
        `*Director:* ${data.Director}\n` +
        `*Actors:* ${data.Actors}\n\n` +
        `*Plot:* ${data.Plot}`;

      let msgOptions = { text };
      if (data.Poster && data.Poster !== 'N/A') {
        msgOptions = {
          image: { url: data.Poster },
          caption: text
        };
      }

      await sock.sendMessage(m.from, msgOptions, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to find movie: ${err.message}`);
    }
  }
};
