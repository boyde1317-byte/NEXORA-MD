/**
 * pinterest2.js — Pinterest search with an inline HTML image navigator.
 *
 *   .pinterest2 <keyword>   search, browse results in an HTML card
 *   .pindl2 <number>        download one result as a full image
 *
 * Ported from the LUNA MD pinterest.js plugin. NexoraFlex already ships
 * .pinterest (src/plugins/download/pinterest.js, aliases pin/pindl/unduh),
 * so this variant is .pinterest2 / .pin2 / .pindl2 and never shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/pinterest.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; the search/download
 *     routing uses the ctx `commandName` (`.pindl2` downloads) instead of
 *     the LUNA command regex.
 *   - The HTML scene now uses the house verification envelope from
 *     src/plugins/general/ping3.js: the shared VERIFICATION_SIGNATURE
 *     constant + certificate chain from
 *     src/assets/htmlgames/certificate.json, a fresh
 *     crypto.randomBytes(32) messageSecret and a fresh
 *     crypto.randomUUID() botResponseId per send. The LUNA original sent
 *     no messageSecret / botResponseId / proofs at all.
 *   - On relay failure the plugin falls back to plain text (top results
 *     listed) instead of throwing.
 *   - Branding 'LUNA MD by MOONSON' -> 'NEXORA MD by MOONSON'; the
 *     download hint points at `.pindl2` (the LUNA text said
 *     `.download number`, an alias this port does not take).
 *   - The per-chat cache key uses `m.from` (was `m.chat`).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from src/plugins/general/ping3.js.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../assets/htmlgames/certificate.json');
let certificateChainCache;
function loadCertificateChain() {
  if (certificateChainCache) return certificateChainCache;
  try {
    const raw = fs.readFileSync(CERT_PATH, 'utf-8');
    const chain = JSON.parse(raw);
    certificateChainCache = Array.isArray(chain) ? chain : [];
  } catch (_) {
    certificateChainCache = [];
  }
  return certificateChainCache;
}

const MAX_IMAGES = 20;
const POOL = 50;
const MAX_BYTES = 500 * 1024;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

async function searchPinterest(query) {
  const all = [];
  const seen = new Set();
  let bookmark = null;
  for (let page = 0; page < 8 && all.length < POOL; page++) {
    const options = { query, scope: 'pins', page_size: 50, ...(bookmark ? { bookmarks: [bookmark] } : {}) };
    const params = new URLSearchParams({
      source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({ options, context: {} }),
      _: String(Date.now()),
    });
    const res = await fetch(`https://www.pinterest.com/resource/BaseSearchResource/get/?${params}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js' },
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    const rr = json?.resource_response;
    const results = rr?.data?.results || [];
    for (const r of results) {
      const thumb = r.images?.['236x']?.url || r.images?.['474x']?.url || r.images?.orig?.url;
      if (!thumb || seen.has(thumb)) continue;
      seen.add(thumb);
      all.push({ thumb, full: r.images?.orig?.url || r.images?.['736x']?.url || r.images?.['474x']?.url || thumb, pin: `https://pinterest.com/pin/${r.id}`, title: r.grid_title || r.title || 'Pinterest' });
    }
    bookmark = rr?.bookmark || json?.resource?.options?.bookmarks?.[0];
    if (!results.length || !bookmark || bookmark === '-end-') break;
  }
  return all;
}

async function toDataUri(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('img ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { uri: `data:${mime};base64,${buf.toString('base64')}`, size: buf.length };
}

async function collectImages(items) {
  const cands = items.slice(0, MAX_IMAGES + 10);
  const settled = await Promise.allSettled(cands.map((x) => toDataUri(x.thumb)));
  const out = [];
  let total = 0;
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    if (out.length >= MAX_IMAGES) return;
    if (total + r.value.size > MAX_BYTES) return;
    total += r.value.size;
    out.push({ ...cands[i], uri: r.value.uri });
  });
  return out;
}

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cache = new Map();
const TTL = 30 * 60 * 1000;
const keyOf = (m) => `${m.from}:${m.sender}`;
function saveCache(m, items) {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > TTL) cache.delete(k);
  cache.set(keyOf(m), { at: now, items: items.map((x) => ({ full: x.full, title: x.title })) });
}

async function downloadPin(m, sock, text, prefix) {
  const n = parseInt((text || '').trim(), 10);
  const entry = cache.get(keyOf(m));
  if (!entry || Date.now() - entry.at > TTL) {
    return sock.sendMessage(m.from, { text: `❌ Search first with ${prefix}pinterest2 <keyword>, then type the image number.\nExample: ${prefix}pinterest2 anime` }, { quoted: m });
  }
  if (!n || n < 1 || n > entry.items.length) {
    return sock.sendMessage(m.from, { text: `❌ Enter a number from 1 to ${entry.items.length}.\nExample: ${prefix}pindl2 2` }, { quoted: m });
  }
  const it = entry.items[n - 1];
  await sock.sendMessage(m.from, { react: { text: '⌛', key: m.key } });
  try {
    const r = await fetch(it.full, { headers: { 'User-Agent': UA, 'Referer': 'https://www.pinterest.com/' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('img ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    await sock.sendMessage(m.from, { image: buf, caption: `*${it.title}*\n\n乂 _NEXORA MD • by MOONSON_` }, { quoted: m });
    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
  } catch (e) {
    await sock.sendMessage(m.from, { text: '❌ Failed to download the image, try another number.' }, { quoted: m });
  }
}

function buildHtml(query, items, hint) {
  const list = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<style>
*{box-sizing:border-box} body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#fff}
.wrap{width:100%;max-width:620px;margin:auto;padding:14px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden}
.head{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.head small{display:block;font-size:10px;letter-spacing:2px;color:#888}.head b{font-size:18px}
.stage{position:relative;background:#000;aspect-ratio:1/1}.stage img{width:100%;height:100%;display:block;object-fit:contain;background:#000}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.55);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.nav.prev{left:12px}.nav.next{right:12px}
.bottom{padding:10px 18px;display:flex;justify-content:space-between}.counter{font-size:12px;color:#999}.hint{font-size:12px;color:#00a884}
</style>
<div class="wrap"><div class="card">
<div class="head"><small>PINTEREST • NEXORA MD by MOONSON</small><b>${esc(query)}</b></div>
<div class="stage"><img id="img" src=""><div class="nav prev" id="prev">&lsaquo;</div><div class="nav next" id="next">&rsaquo;</div></div>
<div class="bottom"><span class="counter" id="counter"></span><span class="hint">${esc(hint)}</span></div>
</div></div>
<script>
const items = ${list}; let idx=0; const img=document.getElementById('img'); const counter=document.getElementById('counter');
function render(){ img.src=items[idx].img; counter.textContent=(idx+1)+' / '+items.length; }
document.getElementById('prev').addEventListener('click',()=>{ idx=(idx-1+items.length)%items.length; render(); });
document.getElementById('next').addEventListener('click',()=>{ idx=(idx+1)%items.length; render(); }); render();
</script>`;
}

export default {
  name: 'pinterest2',
  aliases: ['pin2', 'pindl2'],
  category: 'download',
  description: 'Search Pinterest with an inline HTML image navigator. Usage: .pinterest2 <keyword>, then .pindl2 <number>.',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const command = String(commandName || 'pinterest2').toLowerCase();
    if (command === 'pindl2') return downloadPin(m, sock, args.join(' '), p);

    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(m.from, { text: `*乂 Pinterest - NEXORA MD*\n\nWrite a search keyword.\n\nExample:\n${p}pinterest2 anime aesthetic\n${p}pinterest2 cute cat\n\n> Developer: MOONSON` }, { quoted: m });
    }

    await sock.sendMessage(m.from, { react: { text: '⌛', key: m.key } });
    try {
      const found = shuffle(await searchPinterest(query));
      const items = found.length ? await collectImages(found) : [];
      if (!items.length) {
        await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(m.from, { text: '❌ No results for this search. Try another keyword.' }, { quoted: m });
      }
      saveCache(m, items);
      const html = buildHtml(query, items.map((x) => ({ img: x.uri })), `Type: ${p}pindl2 number | NEXORA by MOONSON`);
      const data = {
        response_id: randomUUID(),
        sections: [
          { __typename: 'GenAIUnifiedResponseSection', view_model: { primitives: [`Query: ${query}`, `Results: ${found.length}`, `Shown: ${items.length}`, 'Bot: NEXORA by MOONSON'].map((t) => ({ prompt_text: t, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' })), __typename: 'GenAIHScrollLayoutViewModel' } },
          { view_model: { primitive: { sources: items.map((x, i) => ({ source_type: 'THIRD_PARTY', source_display_name: `${i + 1} • ${x.title}`.slice(0, 90), source_subtitle: 'NEXORA MD', source_url: x.pin, favicon: { url: 'https://www.pinterest.com/favicon.ico', mime_type: 'image/jpeg', width: 16, height: 16 } })), __typename: 'GenAISearchResultPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } },
          { view_model: { primitive: { payload: html, url: 'https://www.pinterest.com', trusted_sources: ['pinterest.com'], __typename: 'GenAIaeacdsnwHtmlPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } },
        ],
      };
      const responseId = crypto.randomUUID();
      const certificateChain = loadCertificateChain();
      try {
        await sock.relayMessage(m.from, {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            messageSecret: crypto.randomBytes(32),
            botMetadata: {
              messageDisclaimerText: 'Pinterest • NEXORA MD by MOONSON',
              botResponseId: responseId,
              richResponseSourcesMetadata: {},
              ...(certificateChain.length
                ? {
                    verificationMetadata: {
                      proofs: [{
                        version: 1,
                        useCase: 1,
                        signature: VERIFICATION_SIGNATURE,
                        certificateChain,
                      }],
                    },
                  }
                : {}),
            },
          },
          botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages: [{ messageType: 2, messageText: '[ CANNOT_LOAD_HTML ]' }], contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4, stanzaId: m.key.id, participant: m.sender, quotedType: 0, quotedMessage: { extendedTextMessage: { text: `${p}${command} ${query}`, previewType: 0 } } }, unifiedResponse: { data: Buffer.from(JSON.stringify(data), 'utf8').toString('base64') } } } },
        }, {});
        await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
      } catch (relayErr) {
        console.warn('[pinterest2] HTML relay failed, plain fallback:', relayErr.message);
        const list = items.slice(0, 5).map((x, i) => `${i + 1}. ${x.title}`).join('\n');
        await m.reply(`📌 Pinterest results for "${query}" (HTML card failed to send):\n\n${list}\n\nDownload one with ${p}pindl2 <number>`);
      }
    } catch (e) {
      console.log('[pinterest2]', e);
      await sock.sendMessage(m.from, { text: '❌ An error occurred, try again later.\n_NEXORA MD - by MOONSON_' }, { quoted: m });
    }
  },
};
