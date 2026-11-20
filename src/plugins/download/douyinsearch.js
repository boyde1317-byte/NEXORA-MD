/**
 * douyinsearch.js — .douyinsearch / .douyin / .searchdouyin <query> —
 * search Douyin (Chinese TikTok) and send the top video.
 *
 * Ported from LUNA MD plugins/douyinsearch.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No axios / cheerio (NexoraFlex has neither): plain `fetch` with
 *     a small cookie jar built from `getSetCookie()`, and the search
 *     page is scanned with a regex for `<script>` blocks instead of a
 *     DOM parser.
 *   - The original ran the scraped page script with `new Function()`
 *     (executing remote code from the page). That is gone: the embedded
 *     `let data = {...}` object is extracted with a brace-matching scan
 *     and parsed with `JSON.parse` (falling back to just the
 *     `business_data` array). If neither parses, the search fails
 *     cleanly instead of executing anything.
 *   - `handler.limit` is dropped (NexoraFlex has no limit system).
 *   - The video is fetched to a Buffer and sent with
 *     `sock.sendMessage({ video: buf })` (house download pattern).
 */
function extractBalanced(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseDouyinData(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  for (const script of scripts) {
    if (!script.includes('let data =') || !script.includes('"business_data"')) continue;
    const decl = script.indexOf('let data =');
    const brace = script.indexOf('{', decl);
    if (brace === -1) continue;
    const literal = extractBalanced(script, brace);
    if (!literal) continue;
    try {
      return JSON.parse(literal);
    } catch (_) {
      const bdKey = literal.indexOf('"business_data"');
      if (bdKey === -1) continue;
      const arrStart = literal.indexOf('[', bdKey);
      if (arrStart === -1) continue;
      const arr = extractBalanced(literal, arrStart);
      if (!arr) continue;
      try {
        return { business_data: JSON.parse(arr) };
      } catch (_) {
        continue;
      }
    }
  }
  return null;
}

export default {
  name: 'douyinsearch',
  aliases: ['douyin', 'searchdouyin'],
  category: 'download',
  description: 'Search Douyin videos. Usage: .douyinsearch <keyword>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'douyinsearch';
    const query = (args || []).join(' ').trim();
    if (!query) {
      return m.reply(`Example: ${prefix}${cmd} keyword\nExample: ${prefix}${cmd} anime dance`);
    }
    await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });
    try {
      const jar = {};
      const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
      const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
      const collect = (res) => {
        for (const c of res.headers.getSetCookie?.() || []) {
          const pair = c.split(';')[0];
          const i = pair.indexOf('=');
          if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
        }
      };
      await fetch('https://so.douyin.com/', {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'id-ID,id;q=0.9',
          referer: 'https://so.douyin.com/',
          'upgrade-insecure-requests': '1',
          'user-agent': UA,
        },
        signal: AbortSignal.timeout(20000),
      }).then((r) => { collect(r); return r.text().catch(() => ''); }).catch(() => '');
      const params = new URLSearchParams({
        search_entrance: 'aweme',
        enter_method: 'normal_search',
        innerWidth: '431',
        innerHeight: '814',
        reloadNavStart: String(Date.now()),
        is_no_width_reload: '1',
        keyword: query,
      });
      const res = await fetch(`https://so.douyin.com/s?${params.toString()}`, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'id-ID,id;q=0.9',
          referer: 'https://so.douyin.com/',
          'upgrade-insecure-requests': '1',
          'user-agent': UA,
          ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
        },
        signal: AbortSignal.timeout(25000),
      });
      const html = await res.text();
      const fullData = parseDouyinData(html);
      const results = fullData?.business_data?.map((entry) => entry?.data?.aweme_info).filter(Boolean) || [];
      if (!results.length) {
        await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        return m.reply('Not found.');
      }
      const first = results[0];
      const videoUrl = first.video?.play_addr?.url_list?.[0];
      const caption = `${first.desc || 'No description'}\nhttps://www.douyin.com/video/${first.aweme_id}\n\n👤 @${first.author?.nickname || ''}`;
      if (!videoUrl) {
        await sock.sendMessage(m.from, { react: { text: '⚠️', key: m.key } });
        return m.reply('Video not available.');
      }
      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
      const buf = Buffer.from(await (await fetch(videoUrl, {
        headers: { 'User-Agent': UA, Referer: 'https://www.douyin.com/' },
        signal: AbortSignal.timeout(60000),
      })).arrayBuffer());
      await sock.sendMessage(m.from, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m });
    } catch (err) {
      console.error('[douyinsearch] Douyin Error:', err);
      await sock.sendMessage(m.from, { react: { text: '⚠️', key: m.key } });
      return m.reply(`Failed to get data:\n${err.message}`);
    }
  },
};
