import { withReactionStatus } from '../../lib/cosmetics.js';
import { actionCard, actionCardWithAd } from '../../lib/interactiveKit.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { getLyrics } from '../../lib/downloader.js';

export default {
  name: 'lyrics',
  aliases: ['lyric'],
  category: 'utility',
  description: 'Fetch song lyrics. Usage: .lyrics <artist> - <title>',
  cooldown: 6000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query || !query.includes('-')) {
      return await m.reply.info(
        `Usage: \`${prefix}lyrics <artist> - <title>\`\n\nExample: \`${prefix}lyrics Coldplay - Yellow\``,
        'LYRICS'
      );
    }

    await withReactionStatus(m, async () => {
      const [artist, ...rest] = query.split('-');
      const title = rest.join('-').trim();
      const lyrics = await getLyrics(artist.trim(), title);
      const trimmed = lyrics.length > 3500 ? `${lyrics.slice(0, 3500)}\n\n… (truncated)` : lyrics;
      const lyricsText = trimmed;
      const thumbnail = await getBrandThumbnail();
      const searchUrl = `https://genius.com/search?q=${encodeURIComponent(`${artist.trim()} ${title}`)}`;
      try {
        await actionCardWithAd(sock, m.from, { text: lyricsText }, [
          { label: '🎵 Search Another', cmd: `${prefix}lyrics` },
        ], {
          title:    `🎵 ${title.toUpperCase()}`,
          body:     `by ${artist.trim()}`,
          sourceUrl: searchUrl,
          thumbnail,
          renderLargerThumbnail: false,
        }, { quoted: m });
      } catch (_) {
        await m.reply(lyricsText);
      }
    });
  }
};
