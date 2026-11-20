/**
 * xvideossearch.js — .xvideossearch / .xvsearch — search Xvideos, list results.
 *
 * Ported from LUNA MD plugins/xvideossearch.js.
 *
 * GATING (preserved from the original): NO owner gate — the original had
 * only `handler.register = true` (registered-user check, which NexoraFlex
 * does not have). Its NSFW group check was commented out in the original
 * and stays out: NexoraFlex has no per-chat NSFW flag.
 *
 * Differences from the original:
 *   - No axios / cheerio (NexoraFlex has neither): global `fetch` +
 *     regex. The mozaique parse is kept (title link + duration + HD
 *     mark per result block), done with a per-block regex instead of
 *     cheerio selectors.
 *   - No `handler.before` hook: NexoraFlex's dispatcher never calls
 *     before-hooks, so the original's "reply with a number to download"
 *     flow is DEAD here and is replaced with an explicit instruction —
 *     copy a link from the results and run `.xvideosdl <link>`. No
 *     session state is kept.
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; English only.
 */
async function xvideosSearch(query) {
  try {
    const url = `https://www.xvideos.com/?k=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results = [];
    for (const block of html.matchAll(/<div class="thumb-block"[\s\S]*?(?=<div class="thumb-block"|$)/gi)) {
      const b = block[0];
      const title = b.match(/<p class="title">[\s\S]*?<a[^>]+title="([^"]+)"/)?.[1];
      const href = b.match(/<p class="title">[\s\S]*?<a[^>]+href="([^"]+)"/)?.[1];
      if (!title || !href) continue;
      const videoUrl = href.startsWith('http') ? href : 'https://www.xvideos.com' + href;
      const duration = (b.match(/<span class="duration">([^<]*)<\/span>/)?.[1] || '').trim();
      const quality = (b.match(/<span class="video-hd-mark">([^<]*)<\/span>/)?.[1] || '').trim();
      results.push({ title, url: videoUrl, duration, quality });
      if (results.length >= 10) break;
    }
    return results;
  } catch (error) {
    console.error('[xvideossearch]', error);
    return [];
  }
}

export default {
  name: 'xvideossearch',
  aliases: ['xvsearch'],
  category: 'download',
  description: 'Search Xvideos. Usage: .xvideossearch <query> — then .xvideosdl <link> to download',
  cooldown: 5000,
  execute: async ({ m, args, prefix }) => {
    if (!args[0]) {
      return m.reply(
        `⚠️ Please enter the search you want to do on Xvideos.\nExample: ${prefix}xvideossearch zorritas.`
      );
    }

    try {
      try { await m.react('🔍'); } catch (_) {}
      const results = await xvideosSearch(args.join(' '));
      if (results.length === 0) {
        return m.reply(`❌ No results found for: *${args.join(' ')}*`);
      }

      let responseMessage = `*Search results for:* *${args.join(' ')}*\n\n`;
      results.slice(0, 10).forEach((video, index) => {
        responseMessage += `*${index + 1}. ${video.title}*\n`;
        responseMessage += `🕒 Duration: ${video.duration}\n`;
        responseMessage += `🎞️ Quality: ${video.quality || 'SD'}\n`;
        responseMessage += `🔗 ${video.url}\n\n`;
      });
      responseMessage += `> Copy a link and run ${prefix}xvideosdl <link> to download it.`;

      await m.reply(responseMessage);
      try { await m.react('✅'); } catch (_) {}
    } catch (e) {
      console.error('[xvideossearch]', e);
      return m.reply(`❌ An error occurred while searching for videos. Try again.\n${e.message}`);
    }
  },
};
