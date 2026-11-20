/**
 * xnxxdl.js — .xnxxdl — download an Xnxx video from a link (or a search
 * result number from .xnxxsearch).
 *
 * Ported from LUNA MD plugins/xnxxdl.js.
 *
 * GATING (preserved from the original): NO owner gate — the original had
 * only `handler.register = true` (registered-user check, which NexoraFlex
 * does not have). Its NSFW group check was commented out in the original
 * and stays out: NexoraFlex has no per-chat NSFW flag.
 *
 * Differences from the original:
 *   - No node-fetch / cheerio (NexoraFlex has neither): global `fetch`
 *     + regex. The `setVideoUrlLow/High/HLS` extraction regexes are the
 *     original's, kept as-is; og: meta tags are read by regex too.
 *   - The search-result number form (`.xnxxdl 3`) still works: results
 *     are shared with xnxxsearch.js through a process-global list
 *     (`globalThis.__nxVideoListXXX`), the same shape the original kept
 *     in `global.videoListXXX`.
 *   - The video is sent as a document from its URL (house download
 *     pattern) instead of `conn.sendMessage(m.chat, { document: { url } })`
 *     — same shape, `m.chat` -> `m.from`.
 *   - English only (the original already was, apart from one Spanish
 *     example link in the error text, kept as an example).
 */
async function xnxxdl(URL) {
  const res = await fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Xnxx returned ${res.status}`);
  const html = await res.text();

  const meta = (prop) => {
    const m = html.match(new RegExp(`<meta\\s+property="og:${prop}"\\s+content="([^"]*)"`, 'i'));
    return m ? m[1] : null;
  };
  const title = meta('title') || 'xnxx_video';
  const image = meta('image');
  const duration = meta('duration');

  const lowMatch = html.match(/html5player\.setVideoUrlLow\('(.*?)'\)/);
  const highMatch = html.match(/html5player\.setVideoUrlHigh\('(.*?)'\)/);
  const hlsMatch = html.match(/html5player\.setVideoHLS\('(.*?)'\)/);
  void scriptMatch;

  return {
    status: 200,
    result: {
      title,
      URL,
      duration,
      image,
      files: {
        low: lowMatch ? lowMatch[1] : null,
        high: highMatch ? highMatch[1] : null,
        HLS: hlsMatch ? hlsMatch[1] : null,
      },
    },
  };
}

export default {
  name: 'xnxxdl',
  aliases: [],
  category: 'download',
  description: 'Download an Xnxx video. Usage: .xnxxdl <link> or .xnxxdl <number> after .xnxxsearch',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'xnxxdl';
    if (!args[0]) {
      return m.reply(
        `⚠️ Please send an Xnxx link to download the video.\nUsage: ${prefix}${cmd} <Xnxx link>\nExample: ${prefix}${cmd} https://www.xnxx.com/video-xxxx`
      );
    }

    try {
      await m.reply(
        '⏳ The video is being processed, please wait a moment...\n- Sending time depends on the size and duration of the video.'
      );
      let xnxxLink = '';

      if (args[0].includes('xnxx')) {
        xnxxLink = args[0];
      } else {
        const index = parseInt(args[0], 10) - 1;
        if (!Number.isNaN(index) && index >= 0) {
          const list = globalThis.__nxVideoListXXX || [];
          const matchingItem = list.find((item) => item.from === m.sender);
          if (!matchingItem) {
            throw `❌ To use this command this way (${prefix + cmd} <number>), please first search with the command ${prefix}xnxxsearch <text>`;
          }
          if (index < matchingItem.urls.length) {
            xnxxLink = matchingItem.urls[index];
          } else {
            throw `❌ No link was found for that number, please enter a number between 1 and ${matchingItem.urls.length}.`;
          }
        }
      }

      if (!xnxxLink) throw 'Invalid link';

      const res = await xnxxdl(xnxxLink);
      const json = res.result.files;
      if (!json.high && !json.low) throw 'Could not extract the video';

      const videoUrl = json.high || json.low;
      await sock.sendMessage(m.from, {
        document: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: `${res.result.title}.mp4`,
        caption: `*${res.result.title}*`,
      }, { quoted: m });

      try { await m.react('✅'); } catch (_) {}
    } catch (error) {
      console.error('[xnxxdl]', error);
      return m.reply(
        `❌ An error occurred.\n\n- The link must be similar to:\n◉ https://www.xnxx.com/video-14lcwbe8/rubia_novia_follada_en_cuarto_de_bano\n\nDetails: ${error}`
      );
    }
  },
};
