/**
 * google.js — .google / .gnews <query> — Google News search.
 *
 * Ported from luna-md/plugins/google.js. Changes:
 *   - Locale switched from Indonesian (hl=id / gl=ID / id-ID) to English
 *     (hl=en / gl=US / en-US).
 *   - cheerio is NOT a NexoraFlex dependency, so results are parsed out
 *     of the Google News HTML with targeted regexes instead of a DOM.
 *   - The HTML file is built IN MEMORY and sent as a document buffer —
 *     nothing is written to ./tmp and no conn.sendFile is used.
 *   - Uses global fetch (axios is not an NX dep).
 *   - The original's `args.join(' ') || m.text` fallback is dropped:
 *     m.text still contains the command itself, so an empty query is
 *     now a usage error.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}

/**
 * Pull news results out of Google News HTML without cheerio. Each result
 * links through /url?q=<real url>; the chunk after each link up to the
 * next link holds that result's title, snippet, source and time.
 */
function parseNewsResults(html) {
  const linkRe = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>/g;
  const matches = [...html.matchAll(linkRe)];
  const results = [];
  for (let i = 0; i < matches.length; i++) {
    const link = decodeURIComponent(matches[i][1]);
    if (!/^https?:\/\//.test(link)) continue;
    const chunk = html.slice(matches[i].index, matches[i + 1] ? matches[i + 1].index : matches[i].index + 8000);
    const titleMatch =
      chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) ||
      chunk.match(/class="n0jPhd[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
      chunk.match(/class="mCBkyc[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const title = stripTags(titleMatch?.[1]);
    if (!title) continue;
    const snippetMatch = chunk.match(/class="(?:GI74Re|VwiC3b|Y3v8qd)[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const sourceMatch = chunk.match(/class="MgUUmf[^"]*"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/);
    const timeMatch = chunk.match(/class="hvbAAd[^"]*"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/);
    results.push({
      title,
      link,
      snippet: stripTags(snippetMatch?.[1]),
      source: stripTags(sourceMatch?.[1]),
      time: stripTags(timeMatch?.[1]),
    });
    if (results.length >= 10) break;
  }
  return results;
}

function buildNewsHTML(query, items) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(query)}</title>
<style>
body{font-family:Inter,sans-serif;background:#f0f2f5;margin:0;padding:16px}
.wrap{max-width:800px;margin:auto}.head{background:#fff;padding:20px;border-radius:16px;margin-bottom:12px;box-shadow:0 4px 12px rgba(0,0,0,.05)}
.card{background:#fff;padding:16px;border-radius:14px;margin:10px 0;border-right:4px solid #4285F4;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.card a{color:#1a73e8;font-weight:700;text-decoration:none;font-size:17px}
.card p{color:#555;margin:8px 0}.meta{font-size:12px;color:#888}
</style></head><body><div class="wrap">
<div class="head"><h2>🔎 ${escHtml(query)}</h2><small>${items.length} news items • ${new Date().toLocaleString('en-US')}</small></div>
${items.map((r) => `<div class="card"><a href="${escAttr(r.link)}" target="_blank">${escHtml(r.title)}</a><p>${escHtml(r.snippet)}</p><div class="meta">📰 ${escHtml(r.source)} • ${escHtml(r.time)}</div></div>`).join('')}
</div></body></html>`;
}

export default {
  name: 'google',
  aliases: ['gnews'],
  category: 'utility',
  description: 'Search Google News and get the results as text plus an HTML file. Usage: .google <query>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) return await m.reply(`❌ Enter a query!\nExample: *${prefix || '.'}google national team news*`);

    await m.reply(`🔍 _Searching for news: ${query}_`);

    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=US&tbm=nws`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();
      const items = parseNewsResults(html);

      if (!items.length) return await m.reply(`❌ No results found for *${query}*`);

      // 1. Neat text summary
      let caption = `🔎 *GOOGLE NEWS - ${query}*\n\n`;
      items.forEach((r, i) => {
        caption += `*${i + 1}. ${r.title}*\n`;
        caption += `${r.link}\n`;
        caption += `_${r.source}${r.time ? ` • ${r.time}` : ''}_\n\n`;
      });
      await m.reply(caption);

      // 2. HTML file, built in memory and sent as a document buffer
      const doc = buildNewsHTML(query, items);
      const safeName = query.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 40) || 'news';
      await sock.sendMessage(m.from, {
        document: Buffer.from(doc, 'utf-8'),
        fileName: `Google-${safeName}.html`,
        mimetype: 'text/html',
        caption: `📄 HTML file for *${query}*`,
      }, { quoted: m });
    } catch (e) {
      console.error('[google]', e.message);
      await m.reply(`❌ Failed: ${e.message}`);
    }
  },
};
