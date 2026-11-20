/**
 * ph3.js — .ph3 — Pornhub video search (scrape, keyless).
 *
 * Ported from the LUNA MD plugins/#U0628#U0648#U0631#U0646.js
 * (command `ph`). NexoraFlex already has `ph` (pornhub.js) and `ph2`
 * (ph.js), so this one is `ph3` — same search, separate command.
 *
 * PERMISSION GATING — PRESERVED EXACTLY from the original:
 *   - The original gated on `handler.nsfw = true` plus a per-chat
 *     flag: `if (!db.data.chats[m.chat].nsfw && m.isGroup)` it refused
 *     with "nsfw is off, enable with <prefix>nsfw on".
 *   - Ported shape: in a GROUP the command only runs when the group's
 *     `nsfw` flag is on; in a DM the flag is not checked (same as the
 *     original — the check only fired when `m.isGroup`).
 *   - The flag lives on the per-group record (`db.data.groups[jid].nsfw`,
 *     read here via `db.getGroup(m.from).nsfw` with a safe fallback).
 *     NOTE: `nsfw` is NOT in the NexoraFlex db.js group defaults, so
 *     it reads as undefined (= off) until the central db edit adds it.
 *     Reported as a needed field: groups.<jid>.nsfw, default false.
 *   - The `nsfw: true` marker is kept on the export so a future
 *     dispatcher-level NSFW guard can read it, exactly as the LUNA
 *     handler carried `handler.nsfw = true`.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `conn.reply` -> `m.reply`,
 *     `m.chat` -> `m.from`, `db.data.chats` -> `db.data.groups`.
 *   - cheerio is NOT a NexoraFlex dependency, so the result list is
 *     parsed with regexes over the search page HTML instead (same
 *     fields: title, duration, views, url; top 10).
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function searchPornhub(search) {
  try {
    const res = await fetch(`https://www.pornhub.com/video/search?search=${encodeURIComponent(search)}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    const result = [];
    // Each result is an <li class="pcVideoListItem ...">...</li> block.
    const blocks = html.match(/<li[^>]*pcVideoListItem[^>]*>[\s\S]*?<\/li>/g) || [];
    for (const block of blocks) {
      const hrefMatch = block.match(/href="([^"]*view_video\.php\?viewkey=[^"]*)"/);
      const titleMatch = block.match(/title="([^"]+)"/);
      const durationMatch = block.match(/<var class="duration">([^<]*)<\/var>/);
      const viewsMatch = block.match(/<var class="views">([^<]*)<\/var>/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const href = hrefMatch ? hrefMatch[1] : '';
      if (!title || !href) continue;
      const url = href.startsWith('http') ? href : `https://www.pornhub.com${href}`;
      result.push({
        title,
        duration: durationMatch ? durationMatch[1].trim() : '',
        views: viewsMatch ? viewsMatch[1].trim() : '',
        url,
      });
      if (result.length >= 10) break;
    }
    return result;
  } catch (_) {
    return [];
  }
}

export default {
  name: 'ph3',
  aliases: [],
  category: 'download',
  description: 'Search Pornhub videos (NSFW — only works in groups with NSFW enabled). Usage: .ph3 <search>',
  cooldown: 5000,
  // LUNA marker, preserved: this is an NSFW (+18) command.
  nsfw: true,
  execute: async ({ m, args, prefix, db }) => {
    const p = prefix || '.';
    // Original gating, preserved: groups need the per-group nsfw flag on.
    // DMs bypass the check (the original only checked when m.isGroup).
    const groupNsfw = db?.getGroup ? db.getGroup(m.from)?.nsfw : db?.data?.groups?.[m.from]?.nsfw;
    if (!groupNsfw && m.isGroup) {
      return await m.reply(`nsfw is off, enable with ${p}nsfw on`);
    }
    if (!args[0]) {
      return await m.reply(`Example: ${p}ph3 mia khalifa`);
    }
    const results = await searchPornhub(args.join(' '));
    if (!results.length) return await m.reply('No results');
    let text = 'PORNHUB SEARCH - NEXORA MD\n\n';
    text += results.map((v, i) => `${i + 1}. ${v.title}\n${v.duration} | ${v.views}\n${v.url}\n`).join('\n');
    await m.reply(text);
  },
};
