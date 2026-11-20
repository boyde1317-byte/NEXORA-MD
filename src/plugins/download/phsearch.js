/**
 * phsearch.js — .phsearch — Pornhub search (text results).
 *
 * Ported from LUNA MD plugins/phsearch.js.
 *
 * ORIGINAL PERMISSION GATING (preserved):
 *   - NO gating flags at all in the original: no `handler.owner`, no
 *     `handler.rowner`, no `handler.nsfw`. Anyone could run it in a DM.
 *     The ONLY gate was the in-handler group check below.
 *   - In-handler gate: in groups, the command refuses unless the group's
 *     NSFW flag is on (`db.data.chats[m.chat].nsfw` in LUNA). Ported to
 *     `db.getGroup(m.from).nsfw` — NexoraFlex has no `chats` table and
 *     no `.nsfw` toggle command yet, so the flag is undefined (off) until
 *     one is added: group use stays blocked, DM use stays open, exactly
 *     matching the original default-off behaviour.
 *   - NO `pornhubsearch` alias: that name stays with pornhub.js (per the
 *     port brief). The original's command list was
 *     ['phsearch', 'pornhubsearch']; only `phsearch` is kept.
 *
 * Other fixes: the original referenced undefined globals `emoji`,
 * `emoji2` and `msm` in its replies and error log — those would have
 * thrown ReferenceError at runtime. Replaced with plain text.
 * `conn` -> `sock`, `m.chat` -> `m.from`; fetch + regex parsing
 * (cheerio/axios are not NexoraFlex dependencies — the original used
 * them, this port does not).
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
      const _title = decodeEntities(li.match(/title="([^"]+)"/)?.[1] || '').trim();
      const _duration = (li.match(/<var class="duration">([^<]*)<\/var>/)?.[1] || '').trim();
      const _views = (li.match(/<var class="views">([^<]*)<\/var>/)?.[1] || '').trim();
      const href = li.match(/href="(\/view_video\.php[^"]*)"/)?.[1];
      const _url = href ? 'https://www.pornhub.com' + decodeEntities(href) : '';
      const hasil = { title: _title, duration: _duration, views: _views, url: _url };
      result.push(hasil);
    }

    return { result };
  } catch (error) {
    console.error('An error occurred while searching Pornhub:', error);
    return { result: [] };
  }
}

export default {
  name: 'phsearch',
  aliases: [],
  category: 'download',
  description: 'Search Pornhub (text results). NSFW — off in groups unless enabled. Usage: .phsearch <query>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName, db }) => {
    const p = prefix || '.';
    const cmd = commandName || 'phsearch';
    // NSFW gate (ported from the original): groups need the group NSFW
    // flag on; there is no `.nsfw` toggle in NexoraFlex yet, so group use
    // is off by default. DMs are unaffected.
    if (m.isGroup && !db.getGroup(m.from).nsfw) {
      return await m.reply(`*NSFW* content is disabled in this group.\n> An admin can enable it with the command » *${p}nsfw on*`);
    }

    if (!args[0]) {
      return await m.reply(`Please enter the search you want to run on Pornhub.\nExample: ${p + cmd} with my cousin`);
    }

    try {
      const searchResults = await searchPornhub(args[0]);
      let teks = searchResults.result.map((v, i) =>
        `「 *P O R N H U B  - S E A R C H* 」
🎞️ *Title:* ${v.title}
🕒 *Duration:* ${v.duration}
👀 *Views:* ${v.views}
🔗 *Link:* ${v.url}
---------------------------------------------------\n`).join('\n\n');

      if (searchResults.result.length === 0) {
        teks = 'No results found...';
      }

      await m.reply(teks);
    } catch (e) {
      return await m.reply(`An error occurred: ${e.message}`);
    }
  },
};
