import { webClient } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'artist',
  aliases: ['singer', 'band'],
  category: 'media',
  description: 'Search for an artist on iTunes.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(`Usage: \`${prefix}artist <name>\``, 'ARTIST LOOKUP');
    }

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=1`;
      const { data } = await webClient.fetch(url, { useCache: true });

      if (!data.results || data.results.length === 0) {
        throw new Error('Artist not found.');
      }

      const artist = data.results[0];

      const text = `🎤 *ARTIST: ${artist.artistName}*\n\n` +
        `*Genre:* ${artist.primaryGenreName}\n` +
        `*Apple Music:* ${artist.artistLinkUrl}`;

      await copyResultCard(sock, m.from, {
        text,
        footer: 'iTunes API',
        copyLabel: '📋 Copy Link',
        copyValue: artist.artistLinkUrl
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to find artist: ${err.message}`);
    }
  }
};
