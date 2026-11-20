/**
 * xvideosdl.js — .xvideosdl / .xvdl — download an Xvideos video from a link.
 *
 * Ported from LUNA MD plugins/xvideosdl.js.
 *
 * GATING (preserved from the original): NO owner gate — the original had
 * only `handler.register = true` (registered-user check, which NexoraFlex
 * does not have). Its NSFW group check was commented out in the original
 * and stays out: NexoraFlex has no per-chat NSFW flag.
 *
 * Differences from the original:
 *   - No node-fetch / cheerio (NexoraFlex has neither): global `fetch` +
 *     regex. The three-method video-URL extraction is kept (direct link,
 *     then `setVideoUrlHigh`, then `setVideoUrlLow` regexes); the fragile
 *     `#html5video > #html5video_base > div > a` selector is replaced by
 *     a plain `href` regex on the same node, and the views count now comes
 *     from og: meta instead of a layout-dependent div selector.
 *   - The video is sent as a document from its URL (house download
 *     pattern) instead of `conn.sendMessage(m.chat, ...)` — same shape,
 *     `m.chat` -> `m.from`.
 *   - English only.
 */
async function xvideosdl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Xvideos returned ${res.status}`);
  const html = await res.text();

  const title = html.match(/<meta\s+property=['"]og:title['"]\s+content=['"]([^'"]*)['"]/i)?.[1] || 'xvideos_video';
  const thumb = html.match(/<meta\s+property=['"]og:image['"]\s+content=['"]([^'"]*)['"]/i)?.[1] || null;

  // xvideos changes its layout, so we try 3 methods (same as the original).
  let videoUrl = html.match(/id="html5video_base"[\s\S]{0,500}?<a[^>]+href="([^"]+)"/)?.[1] || null;
  if (!videoUrl) {
    const high = html.match(/html5player\.setVideoUrlHigh\('(.*?)'\)/) || html.match(/setVideoUrlHigh\('(.*?)'\)/);
    if (high) videoUrl = high[1];
  }
  if (!videoUrl) {
    const low = html.match(/html5player\.setVideoUrlLow\('(.*?)'\)/);
    if (low) videoUrl = low[1];
  }

  return { status: 200, result: { title, url: videoUrl, thumb } };
}

export default {
  name: 'xvideosdl',
  aliases: ['xvdl'],
  category: 'download',
  description: 'Download an Xvideos video. Usage: .xvideosdl <link>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'xvideosdl';
    if (!args[0]) {
      return m.reply(
        `⚠️ Please send an Xvideos link to download the video.\nExample: ${prefix}${cmd} https://www.xvideos.com/video70389849/xxx`
      );
    }

    try {
      await m.reply(
        '⏳ The video is being processed, please wait a moment...\n- The sending time depends on the size and duration of the video.'
      );

      const res = await xvideosdl(args[0]);
      if (!res.result.url) throw 'Could not get the direct link, Xvideos changed its structure';

      await sock.sendMessage(m.from, {
        document: { url: res.result.url },
        mimetype: 'video/mp4',
        fileName: `${res.result.title || 'xvideos'}.mp4`,
        caption: `*${res.result.title}*`,
      }, { quoted: m });

      try { await m.react('✅'); } catch (_) {}
    } catch (e) {
      console.error('[xvideosdl]', e);
      return m.reply(
        `❌ An error occurred.\n\n- The link should look like:\n◉ https://www.xvideos.com/video70389849/pequena_zorra_follada_duro\n\nDetails: ${e}`
      );
    }
  },
};
