/**
 * pornhub.js — .pornhub / .ph / .phsearch / .pornhubsearch — search
 * Pornhub and download a video.
 *
 * Ported from LUNA MD plugins/pornhub.js.
 *
 * GATING (preserved from the original): OWNER-ONLY. The original had
 * `handler.owner = true; handler.rowner = true; handler.mods = false;
 * handler.premium = false`. NexoraFlex's dispatcher only has an owner
 * gate, so this is `permissions: { owner: true }` — only the owner can
 * run it. Nothing else about the gating changed.
 *
 * Differences from the original:
 *   - No axios / cheerio (NexoraFlex has neither): all fetching is global
 *     `fetch`, all parsing is regex. The flashvars/mediaDefinitions
 *     extraction is the original's regex, kept as-is.
 *   - No `handler.before` hook: NexoraFlex's dispatcher never calls
 *     before-hooks, so the original's "reply with a number to pick a
 *     search result / quality" flow is DEAD here and is replaced with
 *     explicit commands — search lists full URLs, and `.ph <url>`
 *     downloads the best MP4 directly. No session state is kept.
 *   - No ffmpeg HLS remux: the original shelled out to /usr/bin/ffmpeg
 *     (execFile). NexoraFlex runs on Fly where ffmpeg is not installed,
 *     so if only an HLS stream exists the command replies with the HLS
 *     link instead of a file. MP4 (the common case) is sent straight from
 *     its URL with `sock.sendMessage({ video: { url } })` (house download
 *     pattern) — the bot never downloads the video itself.
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, `m.react` kept (house).
 *   - English only (the original already was).
 */
const PH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Referer: 'https://www.pornhub.com',
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
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractViewkey(url) {
  const q = url.match(/[?&]viewkey=([a-zA-Z0-9]+)/);
  if (q) return q[1];
  const p = url.match(/\/video\/([a-zA-Z0-9]+)/);
  if (p) return p[1];
  return null;
}

async function scrapePornhub(url) {
  const viewkey = extractViewkey(url);
  if (!viewkey) throw new Error('viewkey not found');
  const canonicalUrl = `https://www.pornhub.com/view_video.php?viewkey=${viewkey}`;
  const html = await fetchText(canonicalUrl);

  const title =
    decodeEntities(html.match(/<title>([^<]*)<\/title>/i)?.[1] || '')
      .replace(/\s*[-–]\s*Pornhub\.com\s*$/i, '')
      .trim() || 'Unknown Title';
  const thumbnail = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || null;
  const uploader =
    decodeEntities(html.match(/usernameBadgesWrapper[\s\S]{0,400}?>([^<]{1,80})</i)?.[1] || '')
      .trim() || 'Unknown';

  let flashvars = null;
  for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = script[1] || '';
    if (!raw.includes('mediaDefinitions')) continue;
    const m = raw.match(/var\s+flashvars_\d+\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) continue;
    try { flashvars = JSON.parse(m[1]); break; } catch (_) {}
  }
  if (!flashvars) throw new Error('flashvars not found - video private/geo-block');
  const mediaDefinitions = flashvars.mediaDefinitions || [];
  const videoUrls = [];
  for (const def of mediaDefinitions) {
    if (!def.videoUrl) continue;
    if (def.format === 'mp4') {
      videoUrls.push({ type: 'MP4', quality: def.quality ? `${def.quality}p` : 'Default', link: def.videoUrl });
    } else if (def.format === 'hls') {
      videoUrls.push({ type: 'HLS', quality: def.quality ? `${def.quality}p` : 'Auto', link: def.videoUrl });
    }
  }
  videoUrls.sort((a, b) => (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0));
  if (!videoUrls.length) throw new Error('No media found');
  return { title, uploader, thumbnail, videoUrls };
}

async function searchPornhub(query) {
  const html = await fetchText(
    `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`
  );
  const result = [];
  for (const block of html.matchAll(/<li[^>]*pcVideoListItem[\s\S]*?<\/li>/gi)) {
    const li = block[0];
    const title = decodeEntities(li.match(/title="([^"]+)"/)?.[1] || '').trim();
    const href = li.match(/href="(\/view_video\.php[^"]*)"/)?.[1];
    if (!title || !href) continue;
    const duration = (li.match(/<var class="duration">([^<]*)<\/var>/)?.[1] || '').trim();
    const views = (li.match(/<var class="views">([^<]*)<\/var>/)?.[1] || '').trim();
    result.push({ title, duration, views, url: 'https://www.pornhub.com' + decodeEntities(href) });
    if (result.length >= 10) break;
  }
  return result;
}

function isLink(text) {
  if (!text) return null;
  return text.match(/https?:\/\/\S+/gi);
}

export default {
  name: 'pornhub',
  aliases: ['ph', 'pornhubsearch'],
  // NOTE: `phsearch` is intentionally NOT an alias here — it belongs to
  // the separate phsearch.js plugin (ported from LUNA phsearch.js). This
  // file keeps `ph` (the main command) and `pornhubsearch` only.
  category: 'download',
  description: 'Search Pornhub or download a video. Usage: .ph <query> or .ph <url> (owner only)',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const text = (args || []).join(' ').trim();
    const cmd = commandName || 'ph';

    if (!text) {
      return m.reply(
        `*How to use:*\n${prefix}${cmd} <query>\n${prefix}${cmd} <url>\n\nExample:\n${prefix}phsearch arab\n${prefix}ph https://www.pornhub.com/view_video.php?viewkey=xxx`
      );
    }

    // A link -> download the best MP4 directly.
    if (isLink(text)) {
      try { await m.react('⏳'); } catch (_) {}
      try {
        const data = await scrapePornhub(text.trim());
        const mp4 = data.videoUrls.find((v) => v.type === 'MP4');
        if (mp4) {
          await sock.sendMessage(m.from, {
            video: { url: mp4.link },
            caption: `*${data.title}*\nUploader: ${data.uploader}\nQuality: ${mp4.quality}`,
          }, { quoted: m });
          try { await m.react('✅'); } catch (_) {}
          return;
        }
        const hls = data.videoUrls.find((v) => v.type === 'HLS');
        return m.reply(
          `*${data.title}*\nUploader: ${data.uploader}\n\nOnly an HLS stream was found for this video, and this bot cannot convert it — open it here:\n${hls ? hls.link : text.trim()}`
        );
      } catch (e) {
        return m.reply(`⚠️ Failed: ${e.message}`);
      }
    }

    // A query -> search and list links (run `.ph <url>` to download one).
    try { await m.react('🔍'); } catch (_) {}
    try {
      const results = await searchPornhub(text);
      if (!results.length) return m.reply(`❌ No results for: *${text}*`);
      let teks = `「 *P O R N H U B - S E A R C H* 」\n*Query:* ${text}\n\n`;
      teks += results
        .map((v, i) => `*_${i + 1}. ${v.title}_*\n🎞️ ${v.duration} | 👀 ${v.views}\n🔗 ${v.url}\n`)
        .join('\n──────────────\n');
      teks += `\n\n*Run ${prefix}ph <url> to download one.*`;
      await m.reply(teks);
      try { await m.react('✅'); } catch (_) {}
    } catch (e) {
      return m.reply(`⚠️ Error search: ${e.message}`);
    }
  },
};
