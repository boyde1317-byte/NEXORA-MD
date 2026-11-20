/**
 * phimage.js — .phimage / .phimg / .pornhubimage — Pornhub image fetcher.
 *
 * Ported from LUNA MD plugins/phimage.js.
 *
 * ORIGINAL PERMISSION GATING (preserved):
 *   - `handler.owner = true` AND `handler.rowner = true` — owner-only,
 *     and real-owner-only (rowner = the bot's real owner, as opposed to
 *     a sudo/secondary owner). NexoraFlex has a single owner concept, so
 *     both flags map to `permissions: { owner: true }` (dispatcher
 *     enforced). No NSFW flag was set in the original.
 *
 * Differences from the original:
 *   - DROPPED: the `handler.before` hook (reply with a number 1-N to get
 *     the image). NexoraFlex's dispatcher has no `before` hook — plugins
 *     only run on prefixed commands — so the number-reply follow-up
 *     cannot work. Search results and direct-URL fetches are kept.
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; `m.react` kept (house
 *     serialized messages support it).
 *   - fetch + regex parsing (cheerio/axios are not NexoraFlex
 *     dependencies — the original used them, this port does not).
 */
const PH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.pornhub.com',
};

async function fetchText(url) {
  const res = await fetch(url, { headers: PH_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Pornhub returned ${res.status}`);
  return res.text();
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractViewkey(url) {
  const q = url.match(/[?&]viewkey=([a-zA-Z0-9]+)/);
  if (q) return q[1];
  const p = url.match(/\/video\/([a-zA-Z0-9]+)/);
  if (p) return p[1];
  return null;
}

async function scrapePornhubImage(url) {
  const viewkey = extractViewkey(url);
  if (!viewkey) throw new Error('viewkey not found');
  const canonicalUrl = `https://www.pornhub.com/view_video.php?viewkey=${viewkey}`;
  const html = await fetchText(canonicalUrl);
  const title = decodeEntities(html.match(/<title>([^<]*)<\/title>/i)?.[1] || '')
    .replace(/\s*[-–]\s*Pornhub\.com\s*$/i, '').trim() || 'Unknown Title';
  const uploader =
    decodeEntities(html.match(/usernameBadgesWrapper[\s\S]{0,400}?>([^<]{1,80})</i)?.[1] || '')
      .trim() || 'Unknown';

  // Looking for other images on the page
  const images = [];
  for (const m of html.matchAll(/<meta property="og:image" content="([^"]+)"/gi)) {
    const img = m[1];
    if (img && !images.includes(img)) images.push(img);
  }

  if (!images.length) throw new Error('No thumbnail found');
  return { title, uploader, thumbnail: images[0], images };
}

async function searchPornhub(query) {
  const html = await fetchText(`https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`);
  const result = [];
  for (const block of html.matchAll(/<li[^>]*pcVideoListItem[\s\S]*?<\/li>/gi)) {
    const li = block[0];
    const _title = decodeEntities(li.match(/title="([^"]+)"/)?.[1] || '').trim();
    const _duration = (li.match(/<var class="duration">([^<]*)<\/var>/)?.[1] || '').trim();
    const _views = (li.match(/<var class="views">([^<]*)<\/var>/)?.[1] || '').trim();
    const href = li.match(/href="(\/view_video\.php[^"]*)"/)?.[1];
    const _url = href ? 'https://www.pornhub.com' + decodeEntities(href) : '';
    const _thumb = li.match(/<img[^>]+(?:src|data-src)="([^"]+)"/)?.[1] || null;
    if (_title && _url) result.push({ title: _title, duration: _duration, views: _views, url: _url, thumb: _thumb });
  }
  return result.slice(0, 10);
}

function isLink(text) {
  if (!text) return null;
  return text.match(/https?:\/\/\S+/gi);
}

export default {
  name: 'phimage',
  aliases: ['phimg', 'pornhubimage'],
  category: 'download',
  description: 'Fetch Pornhub thumbnails by search or video URL (owner only). Usage: .phimage <query or URL>',
  permissions: { owner: true },
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const cmd = commandName || 'phimage';
    const text = args.join(' ').trim();

    if (!text) {
      return await m.reply(`*How to use:*\n${p + cmd} <query>\n${p + cmd} <url>\n\nExample:\n${p}phimage arab\n${p}phimage https://www.pornhub.com/view_video.php?viewkey=xxx`);
    }

    if (isLink(text)) {
      try {
        await m.react('⏳');
        const data = await scrapePornhubImage(text.trim());
        for (const img of data.images) {
          await sock.sendMessage(m.from, { image: { url: img }, caption: `*${data.title}*\nUploader: ${data.uploader}` }, { quoted: m });
        }
        await m.react('✅');
      } catch (e) { await m.reply(`⚠️ Failed: ${e.message}`); }
      return;
    }

    try {
      await m.react('🔍');
      const results = await searchPornhub(text);
      if (!results.length) return await m.reply(`❌ Nothing found for: *${text}*`);

      let teks = `「 *P O R N H U B - IMAGE* 」\n*Query:* ${text}\n\n`;
      teks += results.map((v, i) => `*_${i + 1}. ${v.title}_*\n🎞️ ${v.duration} | 👀 ${v.views}\n🔗 ${v.url}\n`).join('\n──────────────\n');
      teks += `\n\n*Send the video URL with ${p}phimage <url> to get its image*`;

      await m.reply(teks);
      await m.react('✅');
    } catch (e) {
      await m.reply(`⚠️ Error search: ${e.message}`);
    }
  },
};
