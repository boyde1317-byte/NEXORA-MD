import { webClient } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'podcast',
  aliases: ['podcasts'],
  category: 'media',
  description: 'Search for a podcast on iTunes.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(`Usage: \`${prefix}podcast <name>\``, 'PODCAST SEARCH');
    }

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=1`;
      const { data } = await webClient.fetch(url, { useCache: true });

      if (!data.results || data.results.length === 0) {
        throw new Error('Podcast not found.');
      }

      const pod = data.results[0];

      const text = `🎙️ *PODCAST: ${pod.collectionName}*\n` +
        `*By:* ${pod.artistName}\n\n` +
        `*Genres:* ${(pod.genres || []).join(', ')}\n` +
        `*Episodes:* ${pod.trackCount}\n\n` +
        `🔗 *Link:* ${pod.collectionViewUrl}`;

      let msgOptions = { text };
      if (pod.artworkUrl600) {
        msgOptions = {
          image: { url: pod.artworkUrl600 },
          caption: text
        };
      }

      await sock.sendMessage(m.from, msgOptions, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to find podcast: ${err.message}`);
    }
  }
};
