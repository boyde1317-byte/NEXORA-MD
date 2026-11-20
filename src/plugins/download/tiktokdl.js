/**
 * tiktokdl.js — .tiktokdl <link|query> — download TikTok videos (or
 * search for one) via the tikwm API.
 *
 * Ported from LUNA MD plugins/down-tiktok.js.
 *
 * Name: `tiktokdl` because NexoraFlex already owns `.tiktok` / `.tt` /
 * `.ttdl` (src/plugins/download/tiktok.js). The original's other
 * commands are NOT claimed here.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - The original referenced a free `conn` variable that does not
 *     exist in its own scope (it would throw at runtime) and used
 *     `conn.sendFile` / `conn.sendAlbumMessage` (not available here):
 *     media is fetched to a Buffer in memory and sent with
 *     `sock.sendMessage({ image/video/audio: buf })` (house download
 *     pattern). Multiple photos are sent one by one.
 *   - The dead `if (!res || !res.data) 'Failed...'` string (a no-op
 *     that never stopped the flow) is now a real error.
 *   - `handler.limit` is dropped (NexoraFlex has no limit system).
 */
const TIKTOK_REGEX = /(https:\/\/(vt|vm)\.tiktok\.com\/[^\s]+|https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+)/;

function formatNumber(number) {
  return Number(number || 0).toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) return '00:00';
  const min = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export default {
  name: 'tiktokdl',
  aliases: [],
  category: 'download',
  description: 'Download TikTok videos or search for one. Usage: .tiktokdl <link> | <query>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'tiktokdl';
    const input = m.quoted?.text || (args || []).join(' ').trim();
    try {
      const parseUrl = input.match(TIKTOK_REGEX)?.[0];
      if (parseUrl) {
        await m.react('🔁');
        const res = await (await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(parseUrl)}&hd=1`, {
          signal: AbortSignal.timeout(30000),
        })).json();
        if (!res || !res.data) throw new Error('Failed to get data from TikTok.');
        const data = res.data;
        await m.reply(`# *TIKTOK DOWNLOADER*\n\n> *Title*: ${data.title}\n> *Region*: ${data.region}\n> *Duration*: ${formatDuration(data.duration)}\n> *Views*: ${formatNumber(data.play_count)}\n> *Comments*: ${formatNumber(data.comment_count)}\n> *Share*: ${formatNumber(data.share_count)}\n> *Uploader*: ${data.author?.nickname || data.author?.unique_id}\n\nSending.....`);
        if (data.images && data.images.length > 0) {
          for (const img of data.images) {
            const buf = await fetchBuffer(img);
            await sock.sendMessage(m.from, { image: buf }, { quoted: m });
          }
        } else {
          const buf = await fetchBuffer(data.play);
          await sock.sendMessage(m.from, { video: buf, mimetype: 'video/mp4' }, { quoted: m });
        }
        if (data.music_info?.play) {
          const audio = await fetchBuffer(data.music_info.play);
          await sock.sendMessage(m.from, {
            audio,
            mimetype: 'audio/mpeg',
            fileName: `${data.title || 'tiktok'}.mp3`,
          }, { quoted: m });
        } else {
          await m.reply('Music not found, only sending the media.');
        }
      } else if (input) {
        const search = await (await fetch(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(input)}&count=1&cursor=0&web=1&hd=1`, {
          signal: AbortSignal.timeout(30000),
        })).json();
        const video = search?.data?.videos?.[0];
        if (!video) throw new Error(`Video not found for search "${input}".`);
        const caption = `# *TIKTOK PLAYER*\n\n> *Title:* ${video.title}\n> *Region:* ${video.region}\n> *Duration:* ${formatDuration(video.duration)}\n> *Views:* ${formatNumber(video.play_count)}\n> *Comments:* ${formatNumber(video.comment_count)}\n> *Share:* ${formatNumber(video.share_count)}\n> *Uploader:* ${video.author?.nickname || video.author?.unique_id}`;
        const buf = await fetchBuffer(`https://www.tikwm.com${video.play}`);
        await sock.sendMessage(m.from, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
      } else {
        return m.reply(`*TIKTOK DOWNLOADER*\n> _*• Search:*_ \`${prefix}${cmd} [query]\`\n> _*• Download:*_ \`${prefix}${cmd} [link]\`\n\n*E X A M P L E:*\n> *• ${prefix}${cmd}* cosplayer\n> *• ${prefix}${cmd}* \`https://vt.tiktok.com/xxxxx\``);
      }
    } catch (err) {
      console.error('[tiktokdl]', err);
      return m.reply('❌ An error occurred while processing the request');
    }
  },
};
