/**
 * stickersearch.js — search sticker packs and send one as stickers.
 *
 *   .stickersearch <query>   pick a random matching pack, send up to
 *                            10 of its stickers
 *
 * Ported from the LUNA MD stickerpack.js plugin. The command name is
 * the LUNA alternative name `stickersearch` (the LUNA regex also matched
 * `stickerpack` and `sp`; neither is taken here).
 *
 * Differences from the LUNA MD original (luna-md/plugins/stickerpack.js):
 *   - axios is not a NexoraFlex dependency: both API calls use global
 *     fetch (POST search, GET detail) with the same headers/timeouts.
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; the usage example now
 *     says `.stickersearch` instead of `.sp`.
 *   - No other behaviour change: a random pack from the first page of
 *     results, up to 10 stickers, 1s pacing between sends.
 */
const API_BASE = 'https://getstickerpack.com/api/v1/stickerdb';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function searchPack(query) {
  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        'Referer': 'https://getstickerpack.com/',
        'Origin': 'https://getstickerpack.com',
      },
      body: JSON.stringify({ query, page: 1, size: 20 }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    if (json?.data) return json.data;
    return [];
  } catch (e) {
    console.log('[STICKERSEARCH] Search error:', e.message);
    return [];
  }
}

async function getDetail(slug) {
  try {
    const id = slug.includes('/') ? slug.split('/').pop() : slug;
    const res = await fetch(`${API_BASE}/stickers/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://getstickerpack.com/',
      },
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;
    return {
      title: data.title,
      stickers: data.images.map((i) => `https://s3.getstickerpack.com/${i.url}`),
    };
  } catch (e) {
    console.log('[STICKERSEARCH] Detail error:', e.message);
    return null;
  }
}

export default {
  name: 'stickersearch',
  aliases: [],
  category: 'download',
  description: 'Search sticker packs and send one pack as stickers. Usage: .stickersearch <query>.',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const query = args.join(' ').trim();
    if (!query) {
      return m.reply(`*STICKER PACK*\n\nExample: ${p}stickersearch anime`);
    }

    await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } });

    const packs = await searchPack(query);
    if (!packs.length) {
      await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
      return m.reply(`API search failed. Try a different query or try again later.\nQuery: ${query}`);
    }

    const random = packs[Math.floor(Math.random() * packs.length)];
    const detail = await getDetail(random.slug || random.title);

    if (!detail || !detail.stickers.length) {
      return m.reply(`Failed to fetch pack details for ${random.title}`);
    }

    await m.reply(`> Pack: *${detail.title}*\n> Sending ${Math.min(detail.stickers.length, 10)} sticker(s)...`);

    let sent = 0;
    for (const url of detail.stickers.slice(0, 10)) {
      try {
        await sock.sendMessage(m.from, { sticker: { url } }, { quoted: m });
        sent++;
        await new Promise((r) => setTimeout(r, 1000));
      } catch { continue; }
    }

    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    if (sent === 0) m.reply('Failed to send, the s3 host may be blocked');
  },
};
