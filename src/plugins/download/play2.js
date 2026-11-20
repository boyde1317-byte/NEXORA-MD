/**
 * play2.js — .play2 / .ytm / .ytmusic — YouTube audio + synced lyrics
 * in an interactive HTML music player.
 *
 * Ported from LUNA MD plugins/play2.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`.
 *   - Search uses NexoraFlex's existing path — `youtubeSearch` from
 *     src/lib/downloader.js (the same search .play uses) — instead of
 *     `ytmusic-api` + `yt-search`, which are not NexoraFlex dependencies.
 *     The YouTube Music lyrics fallback (`ytm.getLyrics`) is gone with
 *     them; lyrics come from LRCLIB only now.
 *   - ffmpeg re-encode is DROPPED: the savetube audio is sent as-is.
 *     The HTML player embeds the audio as a data URI, which only works
 *     up to ~8 MB — if the audio is bigger, the player is skipped and
 *     the audio goes out as a plain WhatsApp audio message with the
 *     plain lyrics as text instead.
 *   - sharp thumbnail resize is DROPPED (the player just uses the
 *     YouTube thumbnail URL directly as the poster image).
 *   - The savetube + LRCLIB helpers (savetube, getLRCLyrics,
 *     parseSyncedLyrics, createMusicPlayer) are kept verbatim — savetube
 *     is keyless, LRCLIB is keyless. The savetube metadata decryption
 *     key below is the service's public client key from the original,
 *     not a moonson credential.
 *   - The HTML player send uses the ping3 inline envelope (shared
 *     VERIFICATION_SIGNATURE + certificate loader, fresh
 *     crypto.randomBytes(32) messageSecret + crypto.randomUUID()
 *     botResponseId per send, trusted_sources nexora.dev) with a
 *     plain-text fallback on relay failure. The original sent the
 *     player with no verification block at all.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createDecipheriv, randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { youtubeSearch } from '../../lib/downloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships). Copied from src/plugins/general/ping3.js.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../../assets/htmlgames/certificate.json');
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

// Keyless savetube client config (from the LUNA original — the
// decryption key is savetube's public client key, not a user secret).
const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');
const HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
};
const MAX_ORIGINAL_AUDIO_MB = 25;
const MAX_ORIGINAL_AUDIO_SIZE = MAX_ORIGINAL_AUDIO_MB * 1024 * 1024;
// The HTML player embeds audio as a base64 data URI — above ~8 MB the
// scene payload gets too big to relay, so larger tracks go out as a
// plain audio message instead (see execute).
const MAX_PLAYER_AUDIO_BYTES = 8 * 1024 * 1024;
const LRCLIB_API = 'https://lrclib.net/api';
const LRCLIB_USER_AGENT = 'Bot-Play2/1.0';

async function getLRCLyrics({ title, artist, duration = 0, album = '' }) {
    try {
        if (!title ||!artist) return null;
        const params = new URLSearchParams();
        params.set('track_name', title);
        params.set('artist_name', artist);
        if (album) params.set('album_name', album);
        if (Number.isFinite(Number(duration)) && Number(duration) >= 1 && Number(duration) <= 3600) {
            params.set('duration', Math.round(Number(duration)));
        }
        const url = `${LRCLIB_API}/get?${params.toString()}`;
        const res = await fetch(url, {
            headers: { Accept: 'application/json', 'User-Agent': LRCLIB_USER_AGENT }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data) return null;
        return {
            id: data.id || null,
            trackName: data.trackName || title,
            artistName: data.artistName || artist,
            albumName: data.albumName || '',
            duration: Number(data.duration || duration || 0),
            instrumental: Boolean(data.instrumental),
            plainLyrics: data.plainLyrics || '',
            syncedLyrics: data.syncedLyrics || ''
        };
    } catch { return null; }
}

function parseSyncedLyrics(lrc = '') {
    if (!lrc || typeof lrc!== 'string') return [];
    const result = [];
    const lines = lrc.split(/\r?\n/);
    for (const rawLine of lines) {
        const matches = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        if (!matches.length) continue;
        const text = rawLine.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim();
        for (const match of matches) {
            const minutes = Number(match[1]);
            const seconds = Number(match[2]);
            let fraction = Number(match[3] || 0);
            if (String(match[3] || '').length === 1) fraction *= 100;
            else if (String(match[3] || '').length === 2) fraction *= 10;
            const time = minutes * 60 + seconds + fraction / 1000;
            result.push({ time, text });
        }
    }
    result.sort((a, b) => a.time - b.time);
    return result;
}

function plainLyricsToSynced(lyrics = '') {
    if (!lyrics) return [];
    return lyrics.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((text, index) => ({ time: index * 5, text }));
}

function escapeHtml(text = '') {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(text = '') { return escapeHtml(text); }

function secondsFromTimestamp(timestamp = '') {
    if (!timestamp) return 0;
    const parts = String(timestamp).split(':').map(Number);
    if (parts.some(Number.isNaN)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

function formatDuration(seconds = 0) {
    seconds = Number(seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
}

async function savetube(url, { downloadType = 'audio', quality = '128kbps' } = {}) {
    const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (!idMatch) throw new Error('Invalid YouTube link');
    const videoId = idMatch[1];
    const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: HEADERS }).then(v => v.json()).catch(() => null);
    if (!cdnRes?.cdn) throw new Error('Download server unavailable');
    const cdn = cdnRes.cdn;
    const info = await fetch(`https://${cdn}/v2/info`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` })
    }).then(v => v.json()).catch(() => null);
    if (!info?.data) throw new Error('Failed to fetch video info');
    let metadata;
    try {
        const encrypted = Buffer.from(info.data, 'base64');
        const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
        const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
        metadata = JSON.parse(decrypted.toString('utf8'));
    } catch { throw new Error('Failed to decrypt data from the source'); }
    if (!metadata?.key) throw new Error('Download key unavailable');
    const dl = await fetch(`https://${cdn}/download`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ id: videoId, downloadType, quality, key: metadata.key })
    }).then(v => v.json()).catch(() => null);
    if (!dl?.data?.downloadUrl) throw new Error(dl?.message || 'Failed to get download link');
    return { title: metadata.title, duration: metadata.durationLabel, thumbnail: metadata.thumbnail, url: dl.data.downloadUrl };
}

async function downloadAudioBuffer(url) {
    const res = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
    if (!res.ok) throw new Error(`Failed to download audio (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_ORIGINAL_AUDIO_SIZE) throw new Error('Audio size too large (Max 25MB)');
    return buffer;
}

function createMusicPlayer({ title, artist, duration, audioSrc, imageSrc, lyrics }) {
    const safeTitle = escapeHtml(title);
    const safeArtist = escapeHtml(artist);
    const safeDuration = escapeHtml(duration || '0:00');
    const safeImage = imageSrc || '';
    const lyricsJson = Buffer.from(JSON.stringify(lyrics || []), 'utf8').toString('base64');
    return `
<style>
  :root { --ink:#ffffff; --muted:#b9b1b6; --line:rgba(255,255,255,.22); --sys:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;-webkit-font-smoothing:antialiased;}
 .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px 12px;}
 .player{position:relative;width:100%;max-width:330px;border-radius:18px;overflow:hidden;background:#1a0d12;box-shadow:0 18px 40px rgba(0,0,0,.5);}
 .bg{position:absolute;inset:-30%;width:160%;height:160%;object-fit:cover;filter:blur(38px) saturate(1.5);opacity:.85;z-index:0;}
 .veil{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg, rgba(20,8,12,.55) 0%, rgba(20,8,12,.72) 45%, rgba(12,5,8,.94) 100%);}
 .content{position:relative;z-index:2;padding:16px 18px 20px;}
 .lyrics-panel{position:absolute;inset:0;z-index:10;background:rgba(12,5,8,.96);backdrop-filter:blur(18px);display:flex;flex-direction:column;padding:20px;transform:translateY(100%);transition:transform.35s cubic-bezier(.4,0,.2,1);}
 .lyrics-panel.is-open{transform:translateY(0);}
 .lyrics-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-weight:600;font-size:14px;letter-spacing:1px;flex:none;}
 .lyrics-status{font-size:9px;color:var(--muted);margin-top:4px;letter-spacing:.4px;}
 .lyrics-close{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;}
 .lyrics-text{flex:1;overflow-y:auto;font-size:15px;line-height:1.35;text-align:center;padding:35vh 5px 35vh;scroll-behavior:smooth;overscroll-behavior:contain;}
 .lyric-line{display:block;color:rgba(255,255,255,.32);font-size:15px;font-weight:500;line-height:1.5;padding:7px 4px;margin:2px 0;opacity:.65;transform:scale(.96);transition:color.25s ease, opacity.25s ease, transform.25s ease, filter.25s ease;}
 .lyric-line.is-past{color:rgba(255,255,255,.55);opacity:.72;}
 .lyric-line.is-active{color:#ffffff;opacity:1;transform:scale(1.06);font-weight:700;filter:drop-shadow(0 0 8px rgba(255,255,255,.25));}
 .lyrics-empty{display:flex;min-height:50vh;align-items:center;justify-content:center;color:var(--muted);text-align:center;font-size:13px;line-height:1.7;}
 .lyrics-text::-webkit-scrollbar{width:4px;}.lyrics-text::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:4px;}
 .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;}
 .head__icon{width:18px;height:18px;color:var(--ink);opacity:.85;flex:none;}
 .head__mid{text-align:center;flex:1;min-width:0;}
 .head__from{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
 .head__album{font-size:12px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 .poster{width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.06);box-shadow:0 12px 26px rgba(0,0,0,.45);margin-bottom:18px;}
 .poster img{width:100%;height:100%;object-fit:cover;display:block;}
 .info{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px;}
 .info__names{min-width:0;}
 .info__title{font-size:17px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 .info__artist{font-size:12px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
 .info__heart{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;background:none;border:none;color:var(--muted);cursor:pointer;padding:0;}
 .info__heart.is-on{color:#ff5c8a;}
 .bar{position:relative;height:4px;border-radius:4px;background:rgba(255,255,255,.22);cursor:pointer;margin-bottom:7px;}
 .bar__fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:4px;background:#fff;}
 .bar__dot{position:absolute;top:50%;left:0;width:11px;height:11px;border-radius:50%;background:#fff;transform:translate(-50%,-50%);}
 .time{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:14px;font-variant-numeric:tabular-nums;}
 .controls{display:flex;align-items:center;justify-content:space-between;}
 .ctrl{width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--ink);background:none;border:none;cursor:pointer;padding:0;}
 .ctrl.is-off{opacity:.32;cursor:default;}
 .play{width:56px;height:56px;border-radius:50%;background:#fff;color:#12070b;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;padding:0;box-shadow:0 6px 16px rgba(0,0,0,.4);transition:transform.15s ease;}
 .play:active{transform:scale(.93);}
 .note{margin-top:14px;text-align:center;font-size:10px;color:var(--muted);line-height:1.6;}
</style>
<div class="wrap">
  <div class="player">
    <img class="bg" src="${escapeAttr(safeImage)}" alt=""><div class="veil"></div>
    <div class="lyrics-panel" id="lyrics-panel">
      <div class="lyrics-head"><div><div>LYRICS</div><div class="lyrics-status" id="lyrics-status">Synced lyrics</div></div>
        <div class="lyrics-close" id="btn-close-lyrics"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
      </div><div class="lyrics-text" id="lyrics-text"></div>
    </div>
    <div class="content">
      <div class="head"><svg class="head__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        <div class="head__mid"><div class="head__from">YT Music Audio</div><div class="head__album">${safeArtist}</div></div>
        <svg class="head__icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </div>
      <div class="poster"><img src="${escapeAttr(safeImage)}" alt="${escapeAttr(safeTitle)}"></div>
      <div class="info"><div class="info__names"><div class="info__title">${safeTitle}</div><div class="info__artist">${safeArtist}</div></div>
        <button class="info__heart" id="heart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M20.8 5.6 a5.1 5.1 0 0 0-7.2 0 L12 7.2 l-1.6-1.6 a5.1 5.1 0 0 0-7.2 7.2 l1.6 1.6 L12 21.6 l7.2-7.2 1.6-1.6 a5.1 5.1 0 0 0 0-7.2z"/></svg></button>
      </div>
      <div class="bar" id="bar"><div class="bar__fill" id="fill"></div><div class="bar__dot" id="dot"></div></div>
      <div class="time"><span id="cur">0:00</span><span id="dur">${safeDuration}</span></div>
      <div class="controls">
        <button class="ctrl" id="btn-lyrics"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="21" height="21"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg></button>
        <button class="ctrl is-off" disabled><svg viewBox="0 0 24 24" fill="currentColor" width="21" height="21"><path d="M6 5h2.5v14H6z"/><path d="M20 5.5v13 a.6.6 0 0 1-.93.5 L10 13.1 a.6.6 0 0 1 0-1 l9.07-5.9 a.6.6 0 0 1.93.5z"/></svg></button>
        <button class="play" id="play"><svg id="icon-play" viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5.6 v12.8 a.6.6 0 0 0.92.5 l10-6.4 a.6.6 0 0 0 0-1 l-10-6.4 a.6.6 0 0 0-.92.5z"/></svg><svg id="icon-pause" viewBox="0 0 24 24" fill="currentColor" width="26" height="26" style="display:none"><rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/></svg></button>
        <button class="ctrl is-off" disabled><svg viewBox="0 0 24 24" fill="currentColor" width="21" height="21"><path d="M15.5 5H18v14h-2.5z"/><path d="M4 5.5v13 a.6.6 0 0 0.93.5 L14 13.1 a.6.6 0 0 0 0-1 L4.93 6.2 A.6.6 0 0 0 4 6.7z"/></svg></button>
        <button class="ctrl is-off" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="21" height="21"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1 a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1 a4 4 0 0 1-4 4H3"/></svg></button>
      </div><div class="note">Music Player</div>
    </div>
  </div>
</div>
<audio id="audio" preload="metadata" src="${escapeAttr(audioSrc)}"></audio>
<script>
(function(){
  const audio=document.getElementById('audio');const play=document.getElementById('play');const bar=document.getElementById('bar');const fill=document.getElementById('fill');const dot=document.getElementById('dot');const cur=document.getElementById('cur');const dur=document.getElementById('dur');const heart=document.getElementById('heart');const iconPlay=document.getElementById('icon-play');const iconPause=document.getElementById('icon-pause');const btnLyrics=document.getElementById('btn-lyrics');const btnCloseLyrics=document.getElementById('btn-close-lyrics');const lyricsPanel=document.getElementById('lyrics-panel');const lyricsText=document.getElementById('lyrics-text');const lyricsStatus=document.getElementById('lyrics-status');
  let lyrics=[];try{const encoded='${lyricsJson}';const json=decodeURIComponent(Array.prototype.map.call(atob(encoded),c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));lyrics=JSON.parse(json);}catch(e){lyrics=[];}
  const lyricElements=[];function renderLyrics(){lyricsText.innerHTML='';if(!Array.isArray(lyrics)||!lyrics.length){lyricsStatus.textContent='Lyrics not available';lyricsText.innerHTML='<div class="lyrics-empty">Lyrics not available for this song.</div>';return;}lyricsStatus.textContent='Synced lyrics • LRCLIB';const fragment=document.createDocumentFragment();lyrics.forEach((line,index)=>{const el=document.createElement('div');el.className='lyric-line';el.dataset.index=String(index);el.dataset.time=String(line.time||0);el.textContent=line.text||'♪';fragment.appendChild(el);lyricElements.push(el);});lyricsText.appendChild(fragment);}renderLyrics();
  let activeLyricIndex=-1;function updateLyrics(currentTime){if(!lyrics.length||!lyricElements.length)return;let index=-1;for(let i=0;i<lyrics.length;i++){if(currentTime>=Number(lyrics[i].time||0)){index=i;}else{break;}}if(index===-1||index===activeLyricIndex)return;activeLyricIndex=index;lyricElements.forEach((el,i)=>{el.classList.toggle('is-active',i===index);el.classList.toggle('is-past',i<index);});const active=lyricElements[index];if(active){active.scrollIntoView({behavior:'smooth',block:'center'});}}
  btnLyrics.addEventListener('click',()=>{lyricsPanel.classList.add('is-open');setTimeout(()=>{if(activeLyricIndex>=0&&lyricElements[activeLyricIndex]){lyricElements[activeLyricIndex].scrollIntoView({behavior:'instant',block:'center'});}},100);});
  btnCloseLyrics.addEventListener('click',()=>{lyricsPanel.classList.remove('is-open');});
  function formatTime(sec){if(!Number.isFinite(sec))return'0:00';const h=Math.floor(sec/3600);const m=Math.floor((sec%3600)/60);const s=Math.floor(sec%60);if(h>0)return h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');return m+':'+String(s).padStart(2,'0');}
  function updateProgress(){if(!Number.isFinite(audio.duration)||audio.duration<=0)return;const percent=Math.max(0,Math.min(100,(audio.currentTime/audio.duration)*100));fill.style.width=percent+'%';dot.style.left=percent+'%';cur.textContent=formatTime(audio.currentTime);updateLyrics(audio.currentTime);}
  function setPlaying(){iconPlay.style.display='none';iconPause.style.display='block';}function setPaused(){iconPlay.style.display='block';iconPause.style.display='none';}
  play.addEventListener('click',async function(){try{if(audio.paused){await audio.play();setPlaying();}else{audio.pause();setPaused();}}catch(e){setPaused();}});
  heart.addEventListener('click',()=>{heart.classList.toggle('is-on');});
  bar.addEventListener('pointerdown',function(e){if(!Number.isFinite(audio.duration)||audio.duration<=0)return;const rect=bar.getBoundingClientRect();const x=Math.max(0,Math.min(e.clientX-rect.left,rect.width));audio.currentTime=(x/rect.width)*audio.duration;updateProgress();});
  audio.addEventListener('loadedmetadata',()=>{if(Number.isFinite(audio.duration)){dur.textContent=formatTime(audio.duration);}});
  audio.addEventListener('timeupdate',updateProgress);audio.addEventListener('play',setPlaying);audio.addEventListener('pause',()=>{if(!audio.ended)setPaused();});
  audio.addEventListener('ended',()=>{setPaused();fill.style.width='0%';dot.style.left='0%';cur.textContent='0:00';activeLyricIndex=-1;lyricElements.forEach(el=>{el.classList.remove('is-active','is-past');});});
})();
</script>
`;
}

async function sendMusicPlayer(sock, m, html) {
  const responseId = randomUUID();
  const certificateChain = loadCertificateChain();
  await sock.relayMessage(m.from, {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      botMetadata: {
        messageDisclaimerText: 'Music Player',
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
          submessages: [{ messageType: 2, messageText: 'Music Player' }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify({
              response_id: responseId,
              sections: [{
                view_model: {
                  primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    url: 'https://nexora.dev',
                    trusted_sources: ['nexora.dev'],
                  },
                  __typename: 'GenAISingleLayoutViewModel',
                },
              }],
            })).toString('base64'),
          },
          contextInfo: { forwardingScore: 1, isForwarded: true, forwardOrigin: 4 },
        },
      },
    },
  }, { messageId: responseId });
}

export default {
  name: 'play2',
  aliases: ['ytm', 'ytmusic'],
  category: 'download',
  description: 'YouTube audio with synced lyrics in a music player. Usage: .play2 <song name or YouTube URL>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) return await m.reply.error(`*Enter a song title or YouTube link!*\n\n*Example:* ${prefix || '.'}play2 chase atlantic - swim`);
    await sock.sendMessage(m.from, { react: { text: '🎧', key: m.key } });
    await m.reply('⏳ *Searching and preparing audio...*');
    try {
      let ytUrl = query;
      let title = 'Unknown';
      let artist = 'Unknown Artist';
      let duration = '0:00';
      let durationSec = 0;
      let thumbUrl = '';
      let album = '';
      if (!/youtube\.com|youtu\.be/i.test(query)) {
        // NexoraFlex search path (same as .play): youtubeSearch.
        const results = await youtubeSearch(query);
        const track = results[0];
        if (!track?.url) throw new Error('Song not found on YouTube');
        ytUrl = track.url;
        title = track.title || 'Unknown';
        artist = track.author || 'Unknown Artist';
        duration = typeof track.duration === 'string' ? track.duration : '0:00';
        durationSec = secondsFromTimestamp(duration);
        thumbUrl = track.thumbnail || '';
      } else {
        const match = query.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
        const results = await youtubeSearch(query);
        const vid = results[0];
        if (!vid) throw new Error('Video not found');
        ytUrl = vid.url;
        title = vid.title || 'Unknown';
        artist = vid.author || 'YouTube';
        duration = typeof vid.duration === 'string' ? vid.duration : '0:00';
        durationSec = secondsFromTimestamp(duration);
        thumbUrl = vid.thumbnail || '';
        void match;
      }
      let syncedLyrics = [];
      const lrclib = await getLRCLyrics({ title, artist, duration: durationSec, album });
      if (lrclib?.syncedLyrics) syncedLyrics = parseSyncedLyrics(lrclib.syncedLyrics);
      if (!syncedLyrics.length && lrclib?.plainLyrics) syncedLyrics = plainLyricsToSynced(lrclib.plainLyrics);
      const audioData = await savetube(ytUrl, { downloadType: 'audio', quality: '128kbps' });
      if (!audioData?.url) throw new Error('Audio download link unavailable');
      // Savetube audio as-is — no ffmpeg re-encode.
      const audioBuffer = await downloadAudioBuffer(audioData.url);
      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
      if (audioBuffer.length <= MAX_PLAYER_AUDIO_BYTES) {
        const audioSrc = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
        const html = createMusicPlayer({ title, artist, duration, audioSrc, imageSrc: thumbUrl, lyrics: syncedLyrics });
        try {
          await sendMusicPlayer(sock, m, html);
        } catch (err) {
          console.warn('[play2] player relay failed, audio fallback:', err.message);
          await sock.sendMessage(m.from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
        }
      } else {
        // Too big to embed in the player — plain audio + plain lyrics.
        await sock.sendMessage(m.from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
        const plain = syncedLyrics.map((l) => l.text).filter(Boolean).join('\n');
        await m.reply(`🎵 *${title}* — ${artist}\n⏱️ ${duration}${plain ? `\n\n📝 *Lyrics*\n${plain.slice(0, 4000)}` : ''}`);
      }
    } catch (error) {
      console.error('[play2]', error);
      await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
      await m.reply(`❌ Failed to process the song.\n\n> ${error?.message || 'An unexpected error occurred'}`);
    }
  },
};
