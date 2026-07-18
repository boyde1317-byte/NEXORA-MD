import { withReactionStatus } from '../../lib/cosmetics.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { getLyrics } from '../../lib/downloader.js';

export default {
  name: 'lyrics',
  aliases: ['lyric'],
  category: 'utility',
  description: 'Fetch song lyrics. Usage: .lyrics <artist> - <title>',
  cooldown: 6000,
  execute: async ({ m, args, prefix }) => {
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
      await m.reply(asciiBuilder.box(`LYRICS — ${title.toUpperCase()}`, [trimmed]));
    });
  }
};
