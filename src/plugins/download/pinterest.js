/**
 * pinterest.js — Rem Airich laboratory port.
 * The rich tier preserves Rem's source cards, suggestion pills, and inline
 * HTML image navigator. Gallery and plain-image sends remain fallbacks.
 */
import { AIRich } from '../../lib/NIXCODE.js';
import { pinterestSearch } from '../../lib/downloader.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

const MAX_IMAGES = 20;
const MAX_BYTES = 500 * 1024;
const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map();
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cacheKey = (m) => `${m.from}:${m.sender || ''}`;

async function searchPinterestDirect(query) {
  const all = [];
  const seen = new Set();
  let bookmark = null;
  for (let page = 0; page < 8 && all.length < 50; page += 1) {
    const options = { query, scope: 'pins', page_size: 50, ...(bookmark ? { bookmarks: [bookmark] } : {}) };
    const params = new URLSearchParams({
      source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({ options, context: {} }),
      _: String(Date.now()),
    });
    const response = await fetch(`https://www.pinterest.com/resource/BaseSearchResource/get/?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Pinterest search returned HTTP ${response.status}`);
    const json = await response.json();
    const resource = json?.resource_response;
    const results = resource?.data?.results || [];
    for (const result of results) {
      const thumb = result.images?.['236x']?.url || result.images?.['474x']?.url || result.images?.orig?.url;
      if (!thumb || seen.has(thumb)) continue;
      seen.add(thumb);
      all.push({
        thumb,
        full: result.images?.orig?.url || result.images?.['736x']?.url || result.images?.['474x']?.url || thumb,
        pin: `https://www.pinterest.com/pin/${result.id}`,
        title: result.grid_title || result.title || 'Pinterest image',
      });
    }
    bookmark = resource?.bookmark || json?.resource?.options?.bookmarks?.[0];
    if (!results.length || !bookmark || bookmark === '-end-') break;
  }
  return all;
}

async function toDataUri(url) {
  const response = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`image returned HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const mime = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { uri: `data:${mime};base64,${buffer.toString('base64')}`, size: buffer.length };
}

async function collectImages(items) {
  const candidates = items.slice(0, MAX_IMAGES + 10);
  const settled = await Promise.allSettled(candidates.map((item) => toDataUri(item.thumb)));
  const output = [];
  let total = 0;
  settled.forEach((result, index) => {
    if (result.status !== 'fulfilled' || output.length >= MAX_IMAGES || total + result.value.size > MAX_BYTES) return;
    total += result.value.size;
    output.push({ ...candidates[index], uri: result.value.uri });
  });
  return output;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildHtml(query, items, hint) {
  const list = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<style>*{box-sizing:border-box}body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#fff}.wrap{width:100%;max-width:620px;margin:auto;padding:14px}.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden}.head{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.head small{display:block;font-size:10px;letter-spacing:2px;color:#888}.head b{font-size:18px}.stage{position:relative;background:#000;aspect-ratio:1/1}.stage img{width:100%;height:100%;display:block;object-fit:contain;background:#000}.nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.55);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}.prev{left:12px}.next{right:12px}.bottom{padding:10px 18px;display:flex;justify-content:space-between}.counter{font-size:12px;color:#999}.hint{font-size:12px;color:#00a884}</style><div class="wrap"><div class="card"><div class="head"><small>PINTEREST • NEXORA AIRICH</small><b>${esc(query)}</b></div><div class="stage"><img id="img" src=""><div class="nav prev" id="prev">&lsaquo;</div><div class="nav next" id="next">&rsaquo;</div></div><div class="bottom"><span class="counter" id="counter"></span><span class="hint">${esc(hint)}</span></div></div></div><script>const items=${list};let idx=0;const img=document.getElementById('img');const counter=document.getElementById('counter');function render(){img.src=items[idx].img;counter.textContent=(idx+1)+' / '+items.length}document.getElementById('prev').addEventListener('click',()=>{idx=(idx-1+items.length)%items.length;render()});document.getElementById('next').addEventListener('click',()=>{idx=(idx+1)%items.length;render()});render();</script>`;
}

async function downloadPin({ sock, m, text, prefix }) {
  const entry = cache.get(cacheKey(m));
  const n = Number.parseInt(String(text || '').trim(), 10);
  if (!entry || Date.now() - entry.at > CACHE_TTL) return m.reply(`Search first with ${prefix}pinterest <query>, then send a number.\nExample: ${prefix}pinterest anime`);
  if (!n || n < 1 || n > entry.items.length) return m.reply(`Enter a number from 1 to ${entry.items.length}.\nExample: ${prefix}pindl 2`);
  const item = entry.items[n - 1];
  try {
    const response = await fetch(item.full, { headers: { 'User-Agent': UA, Referer: 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`image returned HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await sock.sendMessage(m.from, { image: buffer, caption: `*${item.title}*\n\nNEXORA • Pinterest` }, { quoted: m });
  } catch (error) {
    await m.reply(`Could not download that image: ${error.message}`);
  }
}

export default {
  name: 'pinterest',
  aliases: ['pin', 'pindl', 'unduh'],
  category: 'download',
  description: 'Search Pinterest with the Rem Airich gallery technique. Usage: .pinterest <query> [number]',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const command = String(commandName || 'pinterest').toLowerCase();
    if (['pindl', 'unduh'].includes(command)) return downloadPin({ sock, m, text: args.join(' '), prefix: p });
    const query = args.join(' ').trim();
    if (!query) return m.reply.info(`Usage: ${p}pinterest <search query>\nExample: ${p}pinterest anime aesthetic\nThen send ${p}pindl 2 to download an image.`, 'PINTEREST SEARCH');
    await withReactionStatus(m, async () => {
      try {
        let found;
        try {
          found = shuffle(await searchPinterestDirect(query));
        } catch (directError) {
          console.warn('[pinterest] direct search failed, using configured backend:', directError.message);
          found = (await pinterestSearch(query)).map((item) => ({
            thumb: item.image || item.url,
            full: item.image || item.url,
            pin: item.pin || item.source || 'https://www.pinterest.com/',
            title: item.title || 'Pinterest image',
          }));
        }
        const items = await collectImages(found);
        if (!items.length) return m.reply('No Pinterest images were found. Try a different query.');
        cache.set(cacheKey(m), { at: Date.now(), items: items.map((item) => ({ full: item.full, title: item.title })) });
        const suggestions = [`${p}pinterest ${query}`, `${p}pindl 1`, `${p}pindl 2`, `${p}pindl 3`];
        const sources = items.map((item, index) => ['https://www.pinterest.com/favicon.ico', item.pin, `${index + 1} • ${item.title}`.slice(0, 90)]);
        const html = buildHtml(query, items.map((item) => ({ img: item.uri })), `Use ${p}pindl <number> to download`);
        await new AIRich(sock)
          .setTitle(`Pinterest • ${query}`)
          .addSuggest(suggestions)
          .addSource(sources)
          .addHtml(html, { trustedSources: ['pinterest.com'], url: 'https://www.pinterest.com' })
          .setFooter('NEXORA • Pinterest Airich port')
          .send(m.from, { quoted: m });
      } catch (error) {
        console.error('[pinterest] search failed:', error);
        await m.reply.error(`Pinterest search failed: ${error.message}`);
      }
    });
  },
};
