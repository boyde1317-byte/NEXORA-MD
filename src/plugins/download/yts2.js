/**
 * yts2.js — .yts2 — YouTube search with a carousel HTML scene.
 *
 * Ported from LUNA MD plugins/yts.js. Searches YouTube (yt-search),
 * fetches the top 10 thumbnails (resized with sharp), and relays an HTML
 * carousel with copy buttons for `.ytmp3` / `.ytmp4`.
 *
 * Differences from the LUNA MD original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, `usedPrefix`/`command` ->
 *     ctx `prefix` / `commandName`.
 *   - The original relay had NO verification proof, NO messageSecret and
 *     NO botResponseId, and trusted_sources was youtube.com. This follows
 *     the house HTML pattern (see src/plugins/general/ping3.js): the
 *     shared VERIFICATION_SIGNATURE constant + certificate chain loaded
 *     from src/assets/htmlgames/certificate.json, a fresh
 *     crypto.randomBytes(32) messageSecret and crypto.randomUUID()
 *     botResponseId per send, trusted_sources nexora.dev.
 *   - On relay failure the original only logged and reacted ❌; this
 *     falls back to a plain-text result list instead of leaving the user
 *     with nothing.
 *   - Branding LUNA MD -> NEXORA MD.
 *
 * Why yts2: NexoraFlex already ships src/plugins/download/play.js (.play,
 * aliases yta/ytmp3/yts/ytsearch/youtubesearch) — the LUNA command names
 * yts/ytsearch/youtubesearch are all taken, so this keeps its own name
 * and claims no aliases.
 *
 * Deps: sharp only (house dependency). Search goes through the house
 * `youtubeSearch` in src/lib/downloader.js (same backend `.play` uses);
 * thumbnails are fetched with global fetch. yt-search/axios are not
 * NexoraFlex dependencies and are not used here.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { youtubeSearch } from '../../lib/downloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships) — see src/plugins/general/ping3.js.
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

const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

async function getThumbnailBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`thumbnail fetch ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  try { return await sharp(data).resize(300, 170).jpeg({ quality: 85 }).toBuffer(); }
  catch { return data; }
}

function buildHtml(query, items, prefix) {
  const list = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<style>
*{box-sizing:border-box;user-select:none}
body{margin:0;background:transparent;font-family:Arial,sans-serif;color:#fff}
.wrap{width:100%;max-width:620px;margin:auto;padding:14px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:18px;overflow:hidden}
.head{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.head small{display:block;font-size:10px;letter-spacing:2px;color:#888}.head b{font-size:16px}
.stage{position:relative;background:#000;aspect-ratio:16/9}.stage img{width:100%;height:100%;display:block;object-fit:contain;background:#000}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,20,.55);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.nav.prev{left:12px}.nav.next{right:12px}
.info{padding:12px 18px}.info b{display:block;font-size:14px;margin-bottom:4px}.info small{color:#aaa;font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.actions{padding:12px 18px;display:flex;gap:10px}
.btn{flex:1;padding:12px;border-radius:12px;border:none;color:#fff;font-size:13px;font-weight:700;text-align:center;cursor:pointer;background:#00a884}
.btn:active{transform:scale(.97)}
.bottom{padding:10px 18px;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.08)}
.counter{font-size:12px;color:#999}
.toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;border:1px solid rgba(255,255,255,.2);display:none}
</style>
<div class="wrap"><div class="card">
<div class="head"><small>YOUTUBE • NEXORA MD</small><b>${query}</b></div>
<div class="stage"><img id="img" src=""><div class="nav prev" id="prev">&lsaquo;</div><div class="nav next" id="next">&rsaquo;</div></div>
<div class="info"><b id="title"></b><small id="sub"></small><small id="url" style="color:#00a884"></small></div>
<div class="actions">
  <div class="btn" id="btnMp3">🎵 Copy .ytmp3</div>
  <div class="btn" id="btnMp4">🎥 Copy .ytmp4</div>
</div>
<div class="bottom"><span class="counter" id="counter"></span><span style="font-size:11px;color:#888">NEXORA</span></div>
</div></div>
<div class="toast" id="toast">Copied!</div>
<script>
const items = ${list};
const usedPrefix = "${prefix}";
let idx=0;
const img=document.getElementById('img'), title=document.getElementById('title'), sub=document.getElementById('sub'), urlEl=document.getElementById('url'), counter=document.getElementById('counter'), toast=document.getElementById('toast');
function showToast(t){ toast.textContent=t; toast.style.display='block'; setTimeout(()=>toast.style.display='none',1500); }
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); showToast('📋 Copied!'); }
  catch{ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('📋 Copied!'); }
}
function render(){
  img.src=items[idx].img; title.textContent=items[idx].title; sub.textContent=items[idx].author+' • '+items[idx].duration; urlEl.textContent=items[idx].url; counter.textContent=(idx+1)+' / '+items.length;
}
document.getElementById('prev').addEventListener('click',()=>{ idx=(idx-1+items.length)%items.length; render(); });
document.getElementById('next').addEventListener('click',()=>{ idx=(idx+1)%items.length; render(); });
document.getElementById('btnMp3').addEventListener('click',()=>{ copyText(usedPrefix+'ytmp3 '+items[idx].url); });
document.getElementById('btnMp4').addEventListener('click',()=>{ copyText(usedPrefix+'ytmp4 '+items[idx].url); });
render();
</script>`;
}

export default {
  name: 'yts2',
  aliases: [],
  category: 'download',
  description: 'YouTube search with a swipeable results carousel. Usage: .yts2 <query>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const query = args.join(' ').trim();
    if (!query) {
      return await sock.sendMessage(m.from, { text: `❌ Keyword is empty!\nExample: ${p}${commandName || 'yts2'} sad songs\n\n> NEXORA MD` }, { quoted: m });
    }
    await m.react('⌛');
    try {
      const rawVideos = await youtubeSearch(query);
      const videos = rawVideos.slice(0, 10).map((v) => ({
        thumbnail: v.thumbnail,
        title: v.title,
        url: v.url,
        author: { name: v.author || 'Unknown' },
        timestamp: v.duration || '',
      }));
      if (!videos?.length) {
        await m.react('❌');
        return await sock.sendMessage(m.from, { text: '⚠️ No results!' }, { quoted: m });
      }

      const firstVideo = videos.slice(0, 10);
      const thumbBuffers = await Promise.allSettled(firstVideo.map((v) => getThumbnailBuffer(v.thumbnail)));
      const sources = [];
      const items = [];

      firstVideo.forEach((v, i) => {
        const thumbUri = thumbBuffers[i].status === 'fulfilled' ? `data:image/jpeg;base64,${thumbBuffers[i].value.toString('base64')}` : v.thumbnail;
        sources.push({
          source_type: 'THIRD_PARTY',
          source_display_name: `${i + 1} • ${v.title}`.slice(0, 90),
          source_subtitle: `📺 ${v.author.name} • ⏱️ ${v.timestamp}`,
          source_url: v.url,
          favicon: { url: 'https://www.youtube.com/favicon.ico', mime_type: 'image/jpeg', width: 16, height: 16 },
        });
        items.push({ img: thumbUri, title: v.title, url: v.url, author: v.author.name, duration: v.timestamp });
      });

      const best = firstVideo[0];
      const plainFallback = firstVideo.map((v, i) => `${i + 1}. ${v.title}\n   📺 ${v.author.name} • ⏱️ ${v.timestamp}\n   ${v.url}`).join('\n\n');

      const data = {
        response_id: crypto.randomUUID(),
        sections: [
          {
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
              primitives: [`Query: ${query}`, `Link: ${best.url}`, `${p}ytmp3 ${best.url}`, `${p}ytmp4 ${best.url}`].map((t) => ({ prompt_text: t, prompt_type: 'SUGGESTED_PROMPT', __typename: 'GenAIFollowUpSuggestionPillPrimitive' })),
              __typename: 'GenAIHScrollLayoutViewModel',
            },
          },
          { view_model: { primitive: { sources, __typename: 'GenAISearchResultPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } },
          { view_model: { primitive: { payload: buildHtml(query, items, p), url: 'https://nexora.dev', trusted_sources: ['nexora.dev'], __typename: 'GenAIaeacdsnwHtmlPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } },
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
              messageDisclaimerText: 'YouTube • NEXORA MD',
              botResponseId: responseId,
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
          botForwardedMessage: {
            message: {
              richResponseMessage: {
                messageType: 1,
                submessages: [{ messageType: 2, messageText: '[ CANNOT_LOAD_HTML ]' }],
                contextInfo: {
                  forwardingScore: 1,
                  isForwarded: true,
                  forwardedAiBotMessageInfo: { botJid: '0@bot' },
                  forwardOrigin: 4,
                  stanzaId: m.key.id,
                  participant: m.sender,
                  quotedType: 0,
                  quotedMessage: { extendedTextMessage: { text: `${p}${commandName || 'yts2'} ${query}`, previewType: 0 } },
                },
                unifiedResponse: { data: Buffer.from(JSON.stringify(data), 'utf8').toString('base64') },
              },
            },
          },
        }, {});
      } catch (err) {
        console.warn('[yts2] HTML relay failed, plain fallback:', err.message);
        await sock.sendMessage(m.from, { text: `🔍 *YouTube results for "${query}"*\n\n${plainFallback}` }, { quoted: m });
      }
      await m.react('✅');
    } catch (e) {
      console.log(e);
      await m.react('❌');
      await m.reply.error(`Search failed: ${e.message}`);
    }
  },
};
