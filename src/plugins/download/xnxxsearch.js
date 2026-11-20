/**
 * xnxxsearch.js — .xnxxsearch / .xnxxs — search Xnxx, list results.
 *
 * Ported from LUNA MD plugins/xnxxsearch.js.
 *
 * GATING (preserved from the original): NO owner gate — the original had
 * only `handler.register = true` (registered-user check, which NexoraFlex
 * does not have) and `handler.group = false` (allowed in DMs too).
 *
 * Differences from the original:
 *   - The NSFW group check at the top of the original is DROPPED. As
 *     written it reads `db.data.chats[m.chat].nsfw` plus the undefined
 *     globals `db`, `conn`, `emoji` and `msm` — in NexoraFlex `db` comes
 *     from ctx, there is no `chats` table and no per-chat NSFW flag, so
 *     the check would throw on every call. There is nothing to check
 *     against; the command runs anywhere.
 *   - No node-fetch / cheerio (NexoraFlex has neither): global `fetch` +
 *     regex. The two-pass parse (thumb hrefs, then thumb-under titles +
 *     metadata) is kept, zipped by index exactly like the original.
 *   - Results are stored in the process-global list
 *     `globalThis.__nxVideoListXXX` (same shape as the original's
 *     `global.videoListXXX`) so `.xnxxdl <number>` can download one.
 *     The list is replaced per sender on each new search, like the
 *     original.
 *   - `conn.reply(m.chat, ...)` -> `m.reply(...)`; English only.
 */
async function xnxxsearch(query) {
  const baseurl = 'https://www.xnxx.com';
  const page = Math.floor(Math.random() * 3) + 1;
  const res = await fetch(`${baseurl}/search/${encodeURIComponent(query)}/${page}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Xnxx returned ${res.status}`);
  const html = await res.text();

  const urls = [];
  for (const b of html.matchAll(/<div class="thumb"[\s\S]*?<\/div>/gi)) {
    const href = b[0].match(/<a[^>]+href="([^"]+)"/)?.[1];
    if (href) urls.push(baseurl + href.replace('/THUMBNUM/', '/'));
  }
  const titles = [];
  const descs = [];
  for (const b of html.matchAll(/<div class="thumb-under"[\s\S]*?<\/div>/gi)) {
    const block = b[0];
    descs.push((block.match(/<p class="metadata">([\s\S]*?)<\/p>/)?.[1] || '').replace(/<[^>]+>/g, '').trim());
    const a = block.match(/<a[^>]+title="([^"]+)"/);
    if (a) titles.push(a[1]);
  }

  const results = [];
  for (let i = 0; i < titles.length; i++) {
    results.push({ title: titles[i], info: descs[i] || '', link: urls[i] || '' });
  }
  return { code: 200, status: true, result: results };
}

export default {
  name: 'xnxxsearch',
  aliases: ['xnxxs'],
  category: 'download',
  description: 'Search Xnxx. Usage: .xnxxsearch <query> — then .xnxxdl <number> to download',
  cooldown: 5000,
  execute: async ({ m, args, prefix }) => {
    const text = (args || []).join(' ').trim();
    if (!text) {
      return m.reply(`Please enter your search.\n> Usage example: ${prefix}xnxxsearch <query>`);
    }

    try {
      const vids_ = { from: m.sender, urls: [] };
      if (!globalThis.__nxVideoListXXX) globalThis.__nxVideoListXXX = [];
      const existing = globalThis.__nxVideoListXXX.findIndex((v) => v.from === m.sender);
      if (existing >= 0) globalThis.__nxVideoListXXX.splice(existing, 1);

      const res = await xnxxsearch(text);
      const json = res.result;
      if (!json.length) return m.reply(`❌ No results for: *${text}*`);

      let cap = `*🔍 Search results:* ${text.toUpperCase()}\n\n`;
      let count = 1;
      for (const v of json) {
        vids_.urls.push(v.link);
        cap += `*[${count}]*\n• *🎬 Title:* ${v.title}\n• *🔗 Link:* ${v.link}\n• *❗ Info:* ${v.info}\n\n`;
        cap += '••••••••••••••••••••••••••••••••\n\n';
        count++;
      }
      cap += `> Download one with: ${prefix}xnxxdl <number>`;

      await m.reply(cap);
      globalThis.__nxVideoListXXX.push(vids_);
    } catch (e) {
      console.error('[xnxxsearch]', e);
      return m.reply(`❌ An error occurred: ${e.message}`);
    }
  },
};
