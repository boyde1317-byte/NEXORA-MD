/**
 * igdl2.js — .igdl2 / .instagdramdl <link> — download Instagram media
 * via the vdraw.ai API.
 *
 * Ported from LUNA MD plugins/down-instagram.js.
 *
 * Name: `igdl2` because NexoraFlex already owns `.ig` / `.instagram` /
 * `.igdl` (src/plugins/download/ig.js). The original's other command
 * (`igdl`) is NOT claimed here; the typo alias `instagdramdl` is kept
 * (it was the original's second trigger and is free).
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No `conn.sendFile` / `conn.sendAlbumMessage` (they do not exist
 *     here): media is fetched to a Buffer in memory and sent with
 *     `sock.sendMessage({ image/video: buf })` (house download pattern,
 *     same as the staged ig2.js). Multiple photos are sent one by one.
 *   - The URL can come from the quoted message or the arguments.
 *   - `handler.limit` is dropped (NexoraFlex has no limit system).
 */
async function igdl(url) {
  const res = await fetch('https://vdraw.ai/api/v1/instagram/ins-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: 'video' }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
  const json = await res.json();
  return json?.data;
}

const IG_REGEX = /(https?:\/\/(?:www\.)?instagram\.com\/(p|reel)\/[a-zA-Z0-9_-]+\/?)/;

export default {
  name: 'igdl2',
  aliases: ['instagdramdl'],
  category: 'download',
  description: 'Download Instagram media from a link. Usage: .igdl2 https://www.instagram.com/p/xxx/',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'igdl2';
    const input = m.quoted?.text || (args || []).join(' ').trim();
    const parseUrl = input.match(IG_REGEX)?.[0];
    if (!parseUrl) {
      return m.reply(`# How to use\n\n> Enter an Instagram URL to download the content\n\n# Example\n> *${prefix}${cmd} https://www.instagram.com/*`);
    }
    try {
      const res = await igdl(parseUrl);
      if (!res || res.error) throw new Error('Failed to get content from Instagram~');
      const result = res.info || [];
      if (!result.length) throw new Error('Failed to get content from Instagram~');
      if (res.media_type === 'photo') {
        for (let i = 0; i < result.length; i++) {
          const mediaRes = await fetch(result[i].url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.instagram.com/' },
            signal: AbortSignal.timeout(60000),
          });
          if (!mediaRes.ok) throw new Error(`media fetch ${mediaRes.status}`);
          const buffer = Buffer.from(await mediaRes.arrayBuffer());
          await sock.sendMessage(m.from, { image: buffer, caption: result.length > 1 ? `✅ Media ${i + 1} of ${result.length}` : '✅ Downloaded' }, { quoted: m });
          await new Promise((r) => setTimeout(r, 1200));
        }
      } else {
        const mediaRes = await fetch(result[0].url, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.instagram.com/' },
          signal: AbortSignal.timeout(60000),
        });
        if (!mediaRes.ok) throw new Error(`media fetch ${mediaRes.status}`);
        const buffer = Buffer.from(await mediaRes.arrayBuffer());
        await sock.sendMessage(m.from, { video: buffer, mimetype: 'video/mp4', caption: '✅ Downloaded' }, { quoted: m });
      }
    } catch (err) {
      console.error('[igdl2] Instagram Error:', err.message);
      return m.reply('❌ There was an error getting the IG media~');
    }
  },
};
