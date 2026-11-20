/**
 * pornhubdl.js — .pornhubdl / .phub / .porn — Pornhub search (text results).
 *
 * Ported from LUNA MD plugins/pornhubdl.js. Despite the "dl" name the
 * original only searches and lists video links — it downloads nothing.
 * That behaviour is kept as-is.
 *
 * ORIGINAL PERMISSION GATING (preserved):
 *   - `handler.nsfw = true` — the LUNA NSFW flag. NexoraFlex has no
 *     `nsfw` permission in its dispatcher contract, so the flag itself
 *     has no contract equivalent; the in-handler gate below is what
 *     actually enforces it.
 *   - In-handler gate: in groups, the command refuses unless the group's
 *     NSFW flag is on (`db.data.chats[m.chat].nsfw` in LUNA). Ported to
 *     `db.getGroup(m.from).nsfw` — NexoraFlex has no `chats` table and
 *     no `.nsfw` toggle command yet, so the flag is undefined (off) until
 *     one is added: group use stays blocked, DM use stays open, exactly
 *     matching the original default-off behaviour.
 *   - NOT owner-gated in the original, and not owner-gated here.
 *   - Original command regex was
 *     /^(ph|pornhub|pornhubsearch|phsearch|phub|porn|pornsearch|pornhubdl)$/i
 *     — narrowed to the assigned name + aliases only (pornhubdl, phub,
 *     porn). `ph` stays free for pornhub.js, `phsearch`/`pornhubsearch`
 *     stay with phsearch.js / pornhub.js.
 *
 * Other changes: `conn` -> `sock`, `m.chat` -> `m.from`; fetch + regex
 * parsing (cheerio/axios are not NexoraFlex dependencies — the original
 * used them, this port does not).
 */
async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(20000),
  });
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

async function searchPornhub(search) {
  try {
    const html = await fetchText(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`);
    const result = [];
    for (const block of html.matchAll(/<li[^>]*pcVideoListItem[\s\S]*?<\/li>/gi)) {
      const li = block[0];
      const title = decodeEntities(li.match(/title="([^"]+)"/)?.[1] || '').trim();
      const duration = (li.match(/<var class="duration">([^<]*)<\/var>/)?.[1] || '').trim();
      const views = (li.match(/<var class="views">([^<]*)<\/var>/)?.[1] || '').trim();
      const href = li.match(/href="(\/view_video\.php[^"]*)"/)?.[1];
      const url = href ? 'https://www.pornhub.com' + decodeEntities(href) : '';
      if (title) result.push({ title, duration, views, url });
    }
    return { result };
  } catch {
    return { result: [] };
  }
}

export default {
  name: 'pornhubdl',
  aliases: ['phub', 'porn'],
  category: 'download',
  description: 'Search Pornhub and list video links (no download). NSFW — off in groups unless enabled. Usage: .pornhubdl <query>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, db }) => {
    const p = prefix || '.';
    // NSFW gate (ported from the original): groups need the group NSFW
    // flag on; there is no `.nsfw` toggle in NexoraFlex yet, so group use
    // is off by default. DMs are unaffected.
    if (m.isGroup && !db.getGroup(m.from).nsfw) {
      return await m.reply(`*NSFW is off*\nTurn it on with ${p}nsfw on`);
    }
    if (!args[0]) return await m.reply(`Example: ${p}pornhubdl mia`);

    const res = await searchPornhub(args.join(' '));
    if (!res.result.length) return await m.reply(`No results for ${args.join(' ')}`);

    const teks = res.result.slice(0, 10).map((v, i) =>
      `*[${i + 1}] P O R N H U B*
🎞️ ${v.title}
🕒 ${v.duration} | 👀 ${v.views}
🔗 ${v.url}
`).join('\n----------------\n');

    await m.reply(teks);
  },
};
