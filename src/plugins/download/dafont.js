/**
 * dafont.js — .dafont search <name> | .dafont dl <link> — search and
 * download fonts from dafont.com.
 *
 * Ported from LUNA MD plugins/down-dafont.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - No cheerio (NexoraFlex has no cheerio): the search page is parsed
 *     with targeted regexes instead. Each result row on dafont lists the
 *     font name + creator in a `.lv1left.dfbg` block, the download count
 *     in a `.light` span, and the zip link in an `a.dl` anchor — the
 *     three lists appear in the same order, so they are paired by index.
 *     If dafont changes its markup the search will simply find nothing.
 *   - The zip is fetched to a Buffer and sent as a document (house
 *     download pattern) instead of relying on a URL document.
 */
async function dafontSearch(query) {
  const res = await fetch(`https://www.dafont.com/search.php?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const html = await res.text();
  const names = [...html.matchAll(/lv1left dfbg[^>]*>([^<]*)/g)].map((x) => x[1].replace(/\s+/g, ' ').trim());
  const links = [...html.matchAll(/<a[^>]*class="dl"[^>]*href="([^"]+)"/g)].map((x) => x[1]);
  const counts = [...html.matchAll(/class="light"[^>]*>([^<]*)/g)].map((x) => x[1].trim());
  const result = [];
  for (let i = 0; i < names.length && i < links.length; i++) {
    const [name, creator] = names[i].split(' by ');
    result.push({
      name: (name || '').trim(),
      creator: (creator || '-').trim(),
      total_down: counts[i] || '-',
      link: links[i].startsWith('http') ? links[i] : `https:${links[i]}`,
    });
  }
  return result;
}

export default {
  name: 'dafont',
  aliases: [],
  category: 'download',
  description: 'Search and download fonts from Dafont. Usage: .dafont search <name> | .dafont dl <link>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'dafont';
    const sub = (args[0] || '').toLowerCase();
    if (!sub) {
      return m.reply(`*Use One Of These Commands*\n\n1 *${prefix}${cmd} search [font_name]*\n   To search fonts by name.\n\n2 *${prefix}${cmd} dl [download_link]*\n   To download a font from a search result link.\n\n*Example:*\n${prefix}${cmd} search fancy\n${prefix}${cmd} dl https://dl.dafont.com/dl/?f=fancy_nancy_2`);
    }
    if (sub === 'search') {
      if (!args[1]) return m.reply('❌ What do you want to search on Dafont?');
      const query = args[1];
      try {
        await m.reply('🔍 Searching fonts...');
        const result = await dafontSearch(query);
        if (!result.length) return m.reply(`❌ Font "${query}" not found`);
        let teks = '*『 DAFONT SEARCH 』*';
        result.slice(0, 10).forEach((font, i) => {
          teks += `\n\n*${i + 1}. ${font.name}*\n✍️ Creator : ${font.creator}\n⬇️ Download : ${font.total_down}\n🔗 ${font.link}`;
        });
        teks += `\n\nUse:\n*${prefix}${cmd} dl [download_link]*`;
        return m.reply(teks);
      } catch (e) {
        console.error('[dafont]', e);
        return m.reply('❌ Error while searching fonts');
      }
    }
    if (sub === 'dl') {
      if (!args[1]) return m.reply('❌ Where is the link?');
      const url = args[1];
      if (!url.startsWith('https://dl.dafont.com/')) return m.reply('❌ Invalid link');
      try {
        await m.reply('⬇️ Downloading font...');
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`An error occurred: ${res.statusText}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const name = url.split('=').pop();
        await sock.sendMessage(m.from, {
          document: buffer,
          mimetype: 'application/zip',
          fileName: `${name}.zip`,
        }, { quoted: m });
      } catch (e) {
        console.error('[dafont]', e);
        return m.reply('❌ Failed to download font');
      }
      return;
    }
    return m.reply(`*Available subcommands:*\n${prefix}${cmd} search\n${prefix}${cmd} dl`);
  },
};
