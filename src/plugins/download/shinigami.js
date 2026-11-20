/**
 * shinigami.js — .shinigami <title> — search/read manhwa & manga via
 * the keyless api.shngm.io API.
 *
 * Ported from LUNA MD plugins/internet-shinigami.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `conn.sendButton` (not a NexoraFlex
 *     helper) -> the house `selectMenu` from src/lib/interactiveKit.js
 *     (same picker shape .play uses: title + sections of rows whose
 *     ids re-invoke this command: `.shinigami detail <id>|<page>`,
 *     `.shinigami read <chapterId>`).
 *   - pdfkit + image-size are DROPPED (not NexoraFlex dependencies).
 *     Chapters are no longer built into a PDF: chapter pages are sent
 *     as consecutive images (first page captioned, the rest plain) —
 *     WhatsApp groups images sent together into an album view.
 *     At most 20 pages per chapter are sent to avoid flooding the chat.
 *   - `m.chat` -> `m.from`; taxonomy lookups guarded (`?.`) so a title
 *     missing an Author/Artist/Genre entry doesn't crash the detail card.
 *   - Errors reply instead of throwing where the original threw inside
 *     the search path.
 *
 * Sub-commands:
 *   .shinigami <title>            search (add |<page> to page)
 *   .shinigami detail <id>|<page> title + chapter picker
 *   .shinigami read <chapterId>   send the chapter pages as images
 */
import { selectMenu } from '../../lib/interactiveKit.js';

const BASE = 'https://api.shngm.io/v1';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const MAX_PAGES = 20;

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Fetch error ${res.status} ${res.statusText}`);
  return res.json();
}

async function getBuffer(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Image fetch error ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

export default {
  name: 'shinigami',
  aliases: [],
  category: 'download',
  description: 'Search and read manhwa/manga. Usage: .shinigami <title>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const cmd = `${p}shinigami`;
    const text = args.join(' ').trim();
    if (!text) return await m.reply.error(`Enter a manhwa title.\n\nExample: \`${p}shinigami solo leveling\``);
    const type = args[0]?.toLowerCase();

    // ── Detail view: title card + chapter picker ──
    if (type === 'detail') {
      const [id, pageRaw] = (args[1] || '').split('|');
      const page = Number(pageRaw) || 1;
      if (!id) return await m.reply.error(`Usage: \`${p}shinigami detail <id>|<page>\``);
      const detail = await getJSON(`${BASE}/manga/detail/${id}`);
      const chapters = await getJSON(`${BASE}/chapter/${id}/list?page=${page}&page_size=10&sort_by=chapter_number&sort_order=asc`);
      const d = detail.data;
      const getNames = (key) => d.taxonomy?.[key]?.map((v) => v.name).join(', ') || '-';
      const detailText = [
        `📘 *${d.title}*`,
        `🈶 ${d.alternative_title || '-'}`,
        '',
        `⭐ Rating: *${d.user_rate}*`,
        `👀 Views: *${Number(d.view_count || 0).toLocaleString()}*`,
        `🏆 Rank: *${d.rank}*`,
        '',
        `📅 Released: *${d.release_year}*`,
        `🌍 Country: *${d.country_id}*`,
        '',
        `👤 Author: *${getNames('Author')}*`,
        `🎨 Artist: *${getNames('Artist')}*`,
        `🏷️ Genre: *${getNames('Genre')}*`,
        '',
        '📝 *Synopsis*:',
        d.description || '-',
      ].join('\n');

      const rows = (chapters?.data || []).map((v) => ({
        id: `${cmd} read ${v.chapter_id}`,
        title: `Chapter ${v.chapter_number}`.slice(0, 60),
        description: new Date(v.release_date).toLocaleDateString('en-US'),
      }));
      const totalPage = chapters?.meta?.total_page || 1;
      if (page > 1) rows.push({ id: `${cmd} detail ${id}|${page - 1}`, title: '⬅️ Prev Page', description: `Page ${page - 1}` });
      if (page < totalPage) rows.push({ id: `${cmd} detail ${id}|${page + 1}`, title: '➡️ Next Page', description: `Page ${page + 1}` });

      return await selectMenu(sock, m.from, {
        text: detailText,
        title: (d.title || 'MANHWA').slice(0, 60),
        subtitle: `⭐ ${d.user_rate || '-'} • Page ${page}/${totalPage}`,
        thumbnail: d.cover_image_url,
      }, '📖 Choose Chapter', [{ title: 'Chapter List', rows }], [], { quoted: m });
    }

    // ── Read a chapter: pages as images (no PDF — pdfkit isn't a dep) ──
    if (type === 'read') {
      const chapterId = args[1];
      if (!chapterId) return await m.reply.error(`Usage: \`${p}shinigami read <chapterId>\``);
      await m.reply('🔁 Fetching chapter pages...');
      try {
        const res = await getJSON(`${BASE}/chapter/detail/${chapterId}`);
        const c = res.data;
        const images = (c.chapter?.data || []).filter((n) => !/\.(webp|gif)$/i.test(n)).slice(0, MAX_PAGES);
        if (!images.length) return await m.reply.error('No readable pages found for this chapter.');
        for (let i = 0; i < images.length; i++) {
          const buf = await getBuffer(`${c.base_url}${c.chapter.path}${images[i]}`);
          await sock.sendMessage(m.from, {
            image: buf,
            ...(i === 0 ? { caption: `📖 Chapter ${c.chapter_number} (${i + 1}/${images.length} pages shown)` } : {}),
          }, { quoted: m });
        }
        return;
      } catch (e) {
        return await m.reply.error(e.message);
      }
    }

    // ── Search ──
    const [query, pageRaw] = text.split('|');
    const page = Number(pageRaw) || 1;
    const res = await getJSON(`${BASE}/manga/list?page=${page}&page_size=15&q=${encodeURIComponent(query.trim())}`);
    if (!res.data?.length) return await m.reply.error(`"${query.trim()}" not found.`);
    const totalPage = res.meta?.total_page || 1;
    const rows = res.data.map((v) => ({
      id: `${cmd} detail ${v.manga_id}|1`,
      title: String(v.title).slice(0, 60),
      description: `⭐ ${v.user_rate} | 👀 ${Number(v.view_count || 0).toLocaleString()}`,
    }));
    if (page > 1) rows.push({ id: `${cmd} ${query.trim()}|${page - 1}`, title: '⬅️ Prev Page', description: `Page ${page - 1}` });
    if (page < totalPage) rows.push({ id: `${cmd} ${query.trim()}|${page + 1}`, title: '➡️ Next Page', description: `Page ${page + 1}` });

    return await selectMenu(sock, m.from, {
      text: `🔎 *Search Results* "${query.trim()}"\n${res.data.length} found`,
      title: 'MANHWA SEARCH',
      subtitle: `Page ${page}/${totalPage}`,
    }, '📚 Choose Manhwa', [{ title: 'Results', rows }], [], { quoted: m });
  },
};
