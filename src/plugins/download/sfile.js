/**
 * sfile.js — .sfile <query> | <sfile.co link> — search sfile.co and
 * download files from it.
 *
 * Ported from LUNA MD plugins/down-sfile.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No cheerio (NexoraFlex has no cheerio): the search results, the
 *     file metadata and the download button are all parsed with
 *     targeted regexes instead. The final download link was already
 *     found by regex in the original and is kept as-is.
 *   - The document is sent from a fetched Buffer (house download
 *     pattern) instead of passing the raw URL object through.
 *   - `String.prototype.capitalize` (a LUNA global that does not exist
 *     here) is replaced with a local capitaliser.
 *   - Errors are plain replies instead of throws.
 */
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function createHeaders(referer) {
  return {
    'User-Agent': UA,
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="137", "Google Chrome";v="137"',
    dnt: '1',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    Referer: referer,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

function extractCookies(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(',').map((c) => c.split(';')[0]).join('; ');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractMetadata(html) {
  const m = {};
  const imgAlt = html.match(/class="overflow-hidden"[^>]*>\s*<img[^>]*alt="([^"]*)"/i)
    || html.match(/<img[^>]*alt="([^"]*)"[^>]*>/i);
  m.filename = imgAlt ? imgAlt[1].trim() : '';
  const spans = [...html.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((x) => x[1].trim()).filter(Boolean);
  m.mimetype = spans[0] || '';
  const strongs = [...html.matchAll(/class="font-semibold"[^>]*>([^<]*)</g)].map((x) => x[1].trim());
  m.download_count = strongs[1] || '';
  m.upload_date = strongs[2] || '';
  const author = html.match(/class="divide-y"[\s\S]{0,2000}?<a[^>]*>([^<]*)<\/a>/i);
  m.author_name = author ? author[1].trim() : '';
  return m;
}

async function sfileSearch(query, page = 1) {
  const res = await fetch(`https://sfile.co/search.php?q=${encodeURIComponent(query)}&page=${page}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const result = [];
  const blocks = html.split(/<div[^>]*class="[^"]*group px-2[^"]*"[^>]*>/).slice(1);
  for (const block of blocks) {
    const end = block.search(/<div[^>]*class="[^"]*group px-2[^"]*"/);
    const chunk = end === -1 ? block : block.slice(0, end);
    const linkMatch = chunk.match(/<a[^>]*href="([^"]+)"/);
    if (!linkMatch) continue;
    const titleMatch = chunk.match(/class="min-w-0"[^>]*>\s*<a[^>]*>([^<]*)<\/a>/)
      || chunk.match(/<a[^>]*>([^<]{2,120})<\/a>/);
    const metaMatch = chunk.match(/class="mt-1"[^>]*>([\s\S]*?)<\/div>/);
    const meta = metaMatch ? stripTags(metaMatch[1]).split('•') : [];
    result.push({
      title: titleMatch ? stripTags(titleMatch[1]) : '',
      size: (meta[0] || '').trim(),
      upload_at: (meta[1] || '').trim(),
      link: linkMatch[1],
    });
  }
  return result;
}

async function sfileDownload(url) {
  const h = createHeaders(url);
  const init = await fetch(url, { headers: h, signal: AbortSignal.timeout(20000) });
  if (!init.ok) throw new Error(`Init request failed (${init.status})`);
  const htmlInit = await init.text();
  const ck = extractCookies(init.headers);
  if (ck) h.Cookie = ck;
  const meta = extractMetadata(htmlInit);
  const dlMatch = htmlInit.match(/id=["']download["'][^>]*data-dw-url=["']([^"']+)["']/i)
    || htmlInit.match(/data-dw-url=["']([^"']+)["']/i);
  const dl = dlMatch && dlMatch[1];
  if (!dl) throw new Error('Download URL not found');
  h.Referer = dl;
  const proc = await fetch(dl, { headers: h, signal: AbortSignal.timeout(20000) });
  if (!proc.ok) throw new Error(`Process request failed (${proc.status})`);
  const htmlProc = await proc.text();
  const scripts = [...htmlProc.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join('\n');
  const re = /https:\\\/\\\/download\d+\.sfile\.co\\\/downloadfile\\\/\d+\\\/\d+\\\/[a-z0-9]+\\\/[^\s'"]+\.[a-z0-9]+(\?[^"']+)?/gi;
  const mt = scripts.match(re);
  if (!mt?.length) throw new Error('Final download link not found in script');
  const fin = mt[0].replace(/\\\//g, '/');
  const fileRes = await fetch(fin, { headers: h, signal: AbortSignal.timeout(120000) });
  if (!fileRes.ok) throw new Error(`File download failed (${fileRes.status})`);
  const download = Buffer.from(await fileRes.arrayBuffer());
  return { metadata: meta, download };
}

function capitalize(s) {
  return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
}

export default {
  name: 'sfile',
  aliases: [],
  category: 'download',
  description: 'Search sfile.co and download files. Usage: .sfile <query> | <sfile.co link>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'sfile';
    const text = (args || []).join(' ').trim();
    if (!text) return m.reply(`Input Query / Sfile Url!\nExample: ${prefix}${cmd} whatsapp mod`);
    try {
      if (/https:\/\/sfile\.co\//i.test(text)) {
        const res = await sfileDownload(text);
        if (!res) throw new Error('Cannot download the file');
        await m.reply(
          Object.entries(res.metadata)
            .map(([k, v]) => `*• ${capitalize(k)}:* ${v}`)
            .join('\n')
            .replaceAll('_', ' ') + '\n\n_Sending file..._'
        );
        await sock.sendMessage(m.from, {
          document: res.download,
          fileName: res.metadata.filename || 'sfile-download',
          mimetype: res.metadata.mimetype || 'application/octet-stream',
        }, { quoted: m });
      } else {
        const [query, page] = text.split('|');
        const res = await sfileSearch(query, page);
        if (!res.length) throw new Error(`Query "${query}" not found`);
        return m.reply(
          res.map((v) => `*Title:* ${v.title}\n*Size:* ${v.size}\n*Link:* ${v.link}\n*Upload at:* ${v.upload_at}`).join('\n\n').trim()
        );
      }
    } catch (e) {
      console.error('[sfile]', e);
      return m.reply(`❌ ${e.message || 'An error occurred while processing the request'}`);
    }
  },
};
