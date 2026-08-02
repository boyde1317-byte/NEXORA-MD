import { withReactionStatus } from '../../lib/cosmetics.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

const URL_RE = /^https?:\/\/.{3,}/i;

export default {
  name: 'tinyurl',
  aliases: ['shorten', 'short', 'shorturl'],
  category: 'utility',
  description: 'Shortens a long URL using TinyURL. No API key required.',
  cooldown: 4000,
  execute: async ({ m, args }) => {
    const url = args[0]?.trim();
    if (!url || !URL_RE.test(url)) {
      return await m.reply.info(
        'Usage: `!tinyurl <url>`\n\nExample: `!tinyurl https://example.com/very/long/path?query=value`',
        'URL SHORTENER'
      );
    }

    await withReactionStatus(m, async () => {
      const res = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error('TinyURL service unavailable.');
      const short = (await res.text()).trim();
      if (!short.startsWith('http')) throw new Error('Invalid response from TinyURL.');

      const text = `🔗 *URL SHORTENER*

` +
        `Original: ${url.length > 55 ? url.slice(0, 52) + '...' : url}
` +
        `Short: *${short}*`;
      try {
        await copyResultCard(sock, m.from, {
          text:       text,
          copyLabel:  'Copy Short URL',
          copyValue:  short,
        }, { quoted: m });
      } catch (_) {
        await m.reply(text);
      }
    });
  }
};
