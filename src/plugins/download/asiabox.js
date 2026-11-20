/**
 * asiabox.js — .asiabox (aliases .abox, .drakor, .drama) — Asian drama
 * search / detail / episode download via asiaboxdrama.com scrape.
 *
 * Ported from the LUNA MD plugins/asiabox.js, keyless (plain HTTP
 * scrape of the site's Next.js flight data).
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch
 *     (axios is not a direct NexoraFlex dependency).
 *   - `conn.reply` / `conn.sendMessage` -> `m.reply` /
 *     `sock.sendMessage`; `m.chat` -> `m.from`.
 *   - SIZE GUARD (new): before downloading an episode video the
 *     Content-Length is probed with HEAD, and the downloaded buffer is
 *     checked too — if the video is over ~100 MB the bot sends the
 *     direct link instead of the file, so a huge episode never dies
 *     mid-upload with an opaque error.
 *   - The scraper author's name is dropped from user-facing output.
 *   - The site locale path segment stays `/id/` — that is the site's
 *     URL structure, not a user-facing language; all bot text is
 *     English.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
const BASE = 'https://asiaboxdrama.com';
// Site URL locale segment (asiaboxdrama.com serves its pages under /id/).
const LANG = 'id';
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
// Videos over this size are linked, not sent as files.
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // ~100 MB

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, cookie) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const headers = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'id-ID,id;q=0.9' };
      if (cookie) headers.cookie = cookie;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      return await res.text();
    } catch (e) {
      err = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw err;
}

function flight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let out = '';
  let m;
  while ((m = re.exec(html))) { try { out += JSON.parse(`"${m[1]}"`); } catch (_) {} }
  return out;
}

function grab(text, key) {
  const res = [];
  const needle = `"${key}":`;
  let i = text.indexOf(needle);
  while (i !== -1) {
    const s = i + needle.length;
    const open = text[s];
    if (open === '[' || open === '{') {
      const close = open === '[' ? ']' : '}';
      let depth = 0;
      let inStr = false;
      let esc = false;
      let j = s;
      for (; j < text.length; j++) {
        const c = text[j];
        if (inStr) {
          if (esc) esc = false;
          else if (c === '\\') esc = true;
          else if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close && --depth === 0) break;
      }
      try { res.push(JSON.parse(text.slice(s, j + 1))); } catch (_) {}
    }
    i = text.indexOf(needle, i + needle.length);
  }
  return res;
}

function uniq(arr) {
  const map = new Map();
  for (const x of arr) {
    const k = x && (x.id || x.slug);
    if (k && !map.has(k)) map.set(k, x);
  }
  return [...map.values()];
}

const item = (e) => ({
  id: e.id, title: e.title, slug: e.slug, image: e.image, episodes: e.episodes_count,
  views: e.views, genres: (e.tags || []).map((t) => t.name), description: e.description,
  url: `${BASE}/${LANG}/movie/${e.slug}`, created_at: e.created_at, updated_at: e.updated_at,
});

const watchUrl = (slug, n) => `${BASE}/${LANG}/watch/${slug}/episode/${n}`;

function fromHtml(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/href="\/id\/(?:movie|episode-list)\/([a-z0-9-]+)"/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ slug: m[1], url: `${BASE}/${LANG}/movie/${m[1]}` });
  }
  return out;
}

function collect(text) {
  const keys = ['movies', 'films', 'dramas', 'items', 'list', 'results', 'data'];
  let out = [];
  for (const k of keys) {
    for (const v of grab(text, k)) {
      if (Array.isArray(v)) out.push(...v);
      else if (v && Array.isArray(v.data)) out.push(...v.data);
      else if (v && v.id && v.slug) out.push(v);
    }
  }
  return uniq(out.filter((o) => o && o.slug));
}

async function listing(url) {
  const html = await get(url);
  const text = flight(html);
  let data = collect(text).map(item);
  if (!data.length) data = fromHtml(html).map((o) => ({ slug: o.slug, title: o.slug, url: o.url }));
  return {
    source: url,
    pagination: grab(text, 'pagination').find((p) => p && (p.page || p.total)) || null,
    total_item: data.length,
    data,
  };
}

function findFilm(text, slug) {
  for (const key of ['film', 'datafilm', 'data', 'entries']) {
    for (const v of grab(text, key)) {
      const hit = (Array.isArray(v) ? v : [v]).find((o) => o && o.slug === slug && o.title);
      if (hit) return hit;
    }
  }
  return null;
}

function findEpisodes(text) {
  const all = grab(text, 'episodes').filter(Array.isArray);
  return all.sort((a, b) => b.length - a.length)[0] || [];
}

async function detail(slug) {
  const text = flight(await get(`${BASE}/${LANG}/movie/${slug}`));
  const film = findFilm(text, slug);
  if (!film) throw new Error(`Film not found: ${slug}`);
  let eps = findEpisodes(text);
  if (!eps.length) {
    const t2 = flight(await get(`${BASE}/${LANG}/episode-list/${slug}`));
    eps = findEpisodes(t2);
  }
  return {
    film: item(film),
    total_episode: eps.length,
    episodes: eps.map((e) => ({ ...e, watch_url: watchUrl(slug, e.number) })),
  };
}

async function episode(slug, num, id) {
  const cookie = id ? `movie=${encodeURIComponent(JSON.stringify({ id, slug }))}` : undefined;
  const text = flight(await get(watchUrl(slug, num), cookie));
  const cur = grab(text, 'currentEpisode')[0] || findEpisodes(text).find((e) => String(e.number) === String(num)) || null;
  const files = cur ? [] : [...new Set(text.match(/https?:\/\/[^"\\\s]+?\.(?:mp4|m3u8|vtt|srt|ass)[^"\\\s]*/gi) || [])];
  const direct = cur ? null : (text.match(/"video":"([^"]+)"/) || [])[1];
  const video = (cur && cur.video) || direct || files.find((u) => /\.(mp4|m3u8)/i.test(u)) || null;
  const subtitle = (cur && (cur.subtitle || cur.subtitle_url || cur.sub)) || files.find((u) => /\.(vtt|srt|ass)/i.test(u)) || null;
  return { number: Number(num), watch_url: watchUrl(slug, num), video, subtitle, detail: cur };
}

async function probeVideoSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return 0;
    return Number(res.headers.get('content-length') || 0);
  } catch (_) {
    return 0;
  }
}

export default {
  name: 'asiabox',
  aliases: ['abox', 'drakor', 'drama'],
  category: 'download',
  description: 'Search Asian dramas and download episodes from Asiabox. Usage: .asiabox search <title> | detail <slug> | eps <slug> <number>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const command = 'asiabox';
    const subCmd = args[0] ? args[0].toLowerCase() : '';
    const query = args.slice(1).join(' ');

    if (!subCmd) {
      return await m.reply(
        '🎬 *ASIABOX DRAMA SCRAPER* 🎬\n\n' +
        'Use these commands:\n' +
        `*${p}${command} search [title]* - Search drama/film\n` +
        `*${p}${command} detail [slug]* - Drama detail info\n` +
        `*${p}${command} eps [slug] [number]* - Download the video directly\n`,
      );
    }

    try {
      if (subCmd === 'search' || subCmd === 's') {
        if (!query) return await m.reply('⚠️ Enter a drama title!');
        await m.reply('⏳ _Searching for drama on Asiabox..._');
        const q = new URLSearchParams({ drama: query, page: '1' });
        const res = await listing(`${BASE}/${LANG}/search?${q.toString()}`);
        if (!res.data || !res.data.length) return await m.reply('❌ Drama not found.');
        let text = `🔍 *SEARCH RESULTS:* "${query}"\n\n`;
        res.data.slice(0, 8).forEach((s, i) => {
          text += `${i + 1}. *${s.title}*\n 🆔 Slug: ${s.slug}\n 🔗 Detail: *${p}${command} detail ${s.slug}*\n\n`;
        });
        if (res.data[0].image) {
          await sock.sendMessage(m.from, { image: { url: res.data[0].image }, caption: text }, { quoted: m });
        } else {
          await m.reply(text);
        }
      } else if (subCmd === 'detail' || subCmd === 'd') {
        if (!query) return await m.reply(`⚠️ Enter a drama slug! Example: *${p}${command} detail the-judge-from-hell*`);
        await m.reply('⏳ _Getting drama details..._');
        const res = await detail(query);
        const film = res.film;
        const text = '🎬 *DETAIL DRAMA* 🎬\n\n' +
          `📌 *Title:* ${film.title}\n` +
          `🎭 *Genre:* ${film.genres ? film.genres.join(', ') : '-'}\n` +
          `📺 *Total Episodes:* ${res.total_episode}\n\n` +
          '💡 *How to download:*\n' +
          `Type *${p}${command} eps ${film.slug} 1*\n`;
        if (film.image) {
          await sock.sendMessage(m.from, { image: { url: film.image }, caption: text }, { quoted: m });
        } else {
          await m.reply(text);
        }
      } else if (subCmd === 'eps' || subCmd === 'e') {
        const slug = args[1];
        const epsNum = args[2];
        if (!slug || !epsNum) return await m.reply(`⚠️ Wrong format! Use: *${p}${command} eps [slug] [number]*`);

        await m.reply(`⏳ _Getting episode ${epsNum} link..._`);
        let id;
        try { id = (await detail(slug)).film.id; } catch (_) {}
        const res = await episode(slug, epsNum, id);

        if (!res.video) return await m.reply('❌ Video link not found.');

        if (res.video.includes('.m3u8')) {
          return await m.reply(
            '⚠️ Streaming format video (.m3u8) can\'t be sent directly to WhatsApp.\n\n' +
            `Please watch manually via this link:\n${res.video}` +
            (res.subtitle ? `\n\n📝 *Subtitle:* ${res.subtitle}` : ''),
          );
        }

        // Size guard: over ~100 MB, send the link instead of the file.
        const declaredSize = await probeVideoSize(res.video);
        if (declaredSize > MAX_VIDEO_BYTES) {
          return await m.reply(
            `⚠️ This episode is about ${(declaredSize / 1024 / 1024).toFixed(0)} MB — too large to send over WhatsApp.\n\n` +
            `Download it here instead:\n${res.video}` +
            (res.subtitle ? `\n\n📝 *Subtitle:* ${res.subtitle}` : ''),
          );
        }

        await m.reply('🚀 _MP4 link found! Downloading and sending the video..._');

        try {
          const vidRes = await fetch(res.video, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(300000) });
          if (!vidRes.ok) throw new Error(`Download failed (HTTP ${vidRes.status}).`);
          const vidBuffer = Buffer.from(await vidRes.arrayBuffer());
          if (vidBuffer.length > MAX_VIDEO_BYTES) {
            return await m.reply(
              `⚠️ This episode is ${(vidBuffer.length / 1024 / 1024).toFixed(0)} MB — too large to send over WhatsApp.\n\n` +
              `Download it here instead:\n${res.video}`,
            );
          }

          await sock.sendMessage(m.from, {
            document: vidBuffer,
            mimetype: 'video/mp4',
            fileName: `${slug}-Eps-${epsNum}.mp4`,
            caption: `🎬 *${slug}* - Episode ${epsNum}`,
          }, { quoted: m });
        } catch (err) {
          await m.reply(`⚠️ Failed to send the video because it is too large.\n\nDownload manually:\n${res.video}`);
        }
      }
    } catch (error) {
      console.error('[AsiaBox Error]:', error);
      await m.reply(`⚠️ An error occurred: ${error.message}`);
    }
  },
};
