/**
 * mediafire.js — .mediafire / .mf <link> — download a file from MediaFire.
 *
 * Ported from LUNA MD plugins/down-mediafire.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No cheerio (NexoraFlex has no cheerio): the download button is
 *     found with one regex for `a#downloadButton` — the only scrape in
 *     the file. File details still come from MediaFire's own JSON API.
 *   - Errors are plain replies instead of throws.
 */
const mediaRegex = /https?:\/\/(www\.)?mediafire\.com\/(file|folder)\/(\w+)/;

async function mediafireInfo(url) {
  const match = mediaRegex.exec(url);
  if (!match) throw new Error('Invalid URL!');
  const id = match[3];
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  const html = await response.text();
  const dlMatch = html.match(/<a[^>]*id=["']downloadButton["'][^>]*href=["']([^"']+)["']/i);
  const download = dlMatch && dlMatch[1];
  if (!download) throw new Error('Failed to get the download link from the Mediafire page.');
  const infoResponse = await fetch(`https://www.mediafire.com/api/1.5/file/get_info.php?response_format=json&quick_key=${id}`, {
    signal: AbortSignal.timeout(20000),
  });
  const json = await infoResponse.json();
  if (json.response.result !== 'Success') throw new Error('Failed to get file info.');
  const info = json.response.file_info;
  const size = parseInt(info.size, 10);
  const ext = info.filename.split('.').pop();
  return {
    filename: info.filename,
    ext,
    size,
    sizeReadable: formatBytes(size),
    download,
    filetype: info.filetype,
    mimetype: info.mimetype || `application/${ext}`,
    privacy: info.privacy,
    owner_name: info.owner_name,
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default {
  name: 'mediafire',
  aliases: ['mf'],
  category: 'download',
  description: 'Download a file from MediaFire. Usage: .mediafire https://www.mediafire.com/file/xxx/file',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'mediafire';
    const text = (args || []).join(' ').trim();
    if (!text) {
      return m.reply(`Example:\n${prefix}${cmd} https://www.mediafire.com/file/941xczxhn27qbby/GBWA_V12.25FF-By.SamMods-.apk/file`);
    }
    if (!mediaRegex.test(text)) return m.reply('❌ Invalid link! Make sure the Mediafire link is correct.');
    try {
      const res = await mediafireInfo(text);
      const caption = `*💌 Name:* ${res.filename}\n*📊 Size:* ${res.sizeReadable}\n*🗂️ FileType :* ${res.filetype}\n*📦 MimeType:* ${res.mimetype}\n*🔐 Privacy:* ${res.privacy}\n*👤 Owner:* ${res.owner_name}`;
      await m.reply(caption);
      await sock.sendMessage(m.from, {
        document: { url: res.download },
        fileName: res.filename,
        mimetype: res.mimetype,
      }, { quoted: m });
    } catch (e) {
      console.error('[mediafire]', e);
      return m.reply('❌ Failed to get the file from Mediafire.');
    }
  },
};
