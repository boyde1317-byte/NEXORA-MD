/**
 * ph2.js — .ph2 — Pornhub search (text results).
 *
 * Ported from LUNA MD plugins/ph.js (command `ph`).
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
      const href = li.match(/href="(\/view_video\.php[^"]*)"/)?.[1];
      const duration = (li.match(/<var class="duration">([^<]*)<\/var>/)?.[1] || '').trim();
      const views = (li.match(/<var class="views">([^<]*)<\/var>/)?.[1] || '').trim();
      const url = href ? 'https://www.pornhub.com' + decodeEntities(href) : '';
      if (title && url && url !== 'https://www.pornhub.comundefined') {
        result.push({ title, duration, views, url });
      }
    }
    return { result };
  } catch (error) {
    return { result: [] };
  }
}

export default {
  name: 'ph2',
  aliases: [],
  category: 'download',
  description: 'Search Pornhub (text results). NSFW — off in groups unless enabled. Usage: .ph2 <query>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, db }) => {
    const p = prefix || '.';
    // NSFW gate (ported from the original): groups need the group NSFW
    // flag on; there is no `.nsfw` toggle in NexoraFlex yet, so group use
    // is off by default. DMs are unaffected.
    if (m.isGroup && !db.getGroup(m.from).nsfw) {
      return await m.reply(`*NSFW* is off in this group.\nEnable it with *${p}nsfw on*`);
    }

    if (!args[0]) {
      return await m.reply(`Enter a query\nExample: ${p}ph2 asian`);
    }

    try {
      const searchResults = await searchPornhub(args.join(' '));
      let teks = searchResults.result.map((v, i) =>
        `「 *P O R N H U B - S E A R C H* 」\n🎞️ *Title:* ${v.title}\n🕒 *Duration:* ${v.duration}\n👀 *Views:* ${v.views}\n🔗 *Link:* ${v.url}\n---------------------------------------------------\n`).join('\n\n');

      if (searchResults.result.length === 0) {
        teks = `No results for *${args.join(' ')}*`;
      }

      await m.reply(teks);
    } catch (e) {
      return await m.reply(`Error: ${e.message}`);
    }
  },
};
