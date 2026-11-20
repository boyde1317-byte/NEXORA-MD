/**
 * play3.js — .play3 / .yta2 / .ytmp32 / .ytmp42 / .ytmp5 / .ytmp6 / .ytv2 —
 * YouTube audio/video downloader with a follow-card for audio.
 *
 * Ported from LUNA MD plugins/play3.js. Search via yt-search, download via
 * a fallback chain of third-party extractors (ytdlv1 -> ytdlv4 -> ytdlv2).
 * Audio requests first show a channel follow card (HTML scene), falling
 * back to a location card, then a plain captioned thumbnail.
 *
 * Differences from the LUNA MD original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, `command` -> ctx `commandName`.
 *   - DROPPED: the SaveNow backend (ytdlv3). It carried a hardcoded
 *     SaveNow API key in the source; NexoraFlex ports carry no hardcoded
 *     keys, so that backend is gone and the chain is v1 -> v4 -> v2.
 *   - The savetube AES key ('C5D58EF67A7584E4A29F6C35BBC4EB12') is kept:
 *     it is a protocol constant the savetube API requires to decrypt its
 *     own responses, not an account credential.
 *   - The follow card's relay now follows the house HTML pattern (see
 *     src/plugins/general/ping3.js): the shared VERIFICATION_SIGNATURE
 *     constant + certificate chain loaded from
 *     src/assets/htmlgames/certificate.json (the original inlined a
 *     NIXEL certificate chain), a fresh crypto.randomBytes(32)
 *     messageSecret and crypto.randomUUID() botResponseId per send, and
 *     trusted_sources nexora.dev (was nixel.dev). The card id was
 *     'rem-bot-' + Date.now(); it is now a random UUID.
 *   - Views formatted with en-US locale (was id-ID).
 *   - Branding LUNA MD -> NEXORA MD.
 *
 * Deps: sharp only (house dependency). Search goes through the house
 * `youtubeSearch` in src/lib/downloader.js (same backend `.play` uses);
 * all HTTP is global `fetch`. yt-search/axios are not NexoraFlex
 * dependencies and are not used here. The channel lookup that used
 * yt-search's channel search is gone — the follow card now uses the
 * channel data from the video's own search result.
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

const savetube = {
  api: { base: 'https://media.savetube.me/api', cdn: '/random-cdn', info: '/v2/info', download: '/download' },
  headers: { 'accept': '*/*', 'content-type': 'application/json', 'origin': 'https://yt.savetube.me', 'referer': 'https://yt.savetube.me/', 'user-agent': 'Postify/1.0.0' },
  formatVideo: ['144', '240', '360', '480', '720', '1080'],
  formatAudio: ['mp3', 'm4a', 'webm', 'aac', 'flac', 'opus', 'ogg', 'wav'],
  crypto: {
    hexToBuffer: (hexString) => Buffer.from(hexString.match(/.{1,2}/g).join(''), 'hex'),
    decrypt: async (enc) => {
      // Protocol constant required to decrypt savetube's own responses.
      const secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
      const data = Buffer.from(enc, 'base64');
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      let decrypted = decipher.update(content);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },
  isUrl: (str) => { try { new URL(str); return true; } catch (_) { return false; } },
  youtube: (url) => {
    if (!url) return null;
    const a = [/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/];
    for (const b of a) if (b.test(url)) return url.match(b)[1];
    return null;
  },
  request: async (endpoint, data = {}, method = 'post') => {
    try {
      const url = `${endpoint.startsWith('http') ? '' : savetube.api.base}${endpoint}`;
      const res = await fetch(url, {
        method,
        headers: savetube.headers,
        body: method === 'post' ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const response = await res.json().catch(() => null);
      return { status: true, code: res.status, data: response };
    } catch (error) { return { status: false, code: error.status || 500, error: error.message }; }
  },
  getCDN: async () => {
    const response = await savetube.request(savetube.api.cdn, {}, 'get');
    if (!response.status) return response;
    return { status: true, code: 200, data: response.data.cdn };
  },
  download: async (link, format) => {
    const allFormats = [...savetube.formatVideo, ...savetube.formatAudio];
    if (!allFormats.includes(format)) return { status: false };
    const id = savetube.youtube(link); if (!id) return { status: false };
    try {
      const cdnx = await savetube.getCDN(); if (!cdnx.status) return cdnx;
      const cdn = cdnx.data;
      const result = await savetube.request(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` });
      if (!result.status) return result;
      const decrypted = await savetube.crypto.decrypt(result.data.data);
      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, { id, downloadType: savetube.formatAudio.includes(format) ? 'audio' : 'video', quality: savetube.formatAudio.includes(format) ? '128' : format, key: decrypted.key });
      return { status: true, title: decrypted.title || 'YouTube Media', download_url: dl.data.data.downloadUrl };
    } catch { return { status: false }; }
  },
};

async function ytSearch(query, limit = 5) {
  const result = await youtubeSearch(query);
  return result.slice(0, limit).map((v) => ({ id: v.videoId, title: v.title, url: v.url, channel: v.author || 'Unknown', channelUrl: '', duration: v.duration || '0:00', views: v.views ? Number(v.views).toLocaleString('en-US') : '0', thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, ago: '' }));
}

async function ytdlv1(url, type) {
  try {
    const endpoint = type === 'audio' ? `https://ytdlpyton.nvlgroup.my.id/download/audio?url=${encodeURIComponent(url)}&mode=url` : `https://ytdlpyton.nvlgroup.my.id/download/?url=${encodeURIComponent(url)}&resolution=${type}&mode=url`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return { status: false };
    const data = await res.json().catch(() => null);
    if (!data || !data.download_url) return { status: false };
    return { title: data.title || 'YouTube Media', download_url: data.download_url, status: true };
  } catch { return { status: false }; }
}

async function ytdlv2(url, res) {
  try {
    const resp = await fetch('https://app.ytdown.to/proxy.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': '*/*', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://app.ytdown.to/id12/' },
      body: new URLSearchParams({ url }).toString(),
      signal: AbortSignal.timeout(30000),
    });
    const data = await resp.json().catch(() => null);
    const api = data?.api; if (!api || !api.mediaItems) return { status: false };
    let target = null;
    if (res === 'audio' || res === 'mp3') target = api.mediaItems.find((v) => v.type === 'Audio' && v.mediaQuality === '128K') || api.mediaItems.find((v) => v.type === 'Audio');
    else target = api.mediaItems.find((v) => v.type === 'Video' && v.mediaQuality === 'HD') || api.mediaItems.find((v) => v.type === 'Video');
    if (!target) return { status: false };
    let download_url = null;
    for (let i = 0; i < 20; i++) {
      try {
        const checkRes = await fetch(target.mediaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        const check = await checkRes.json().catch(() => ({}));
        if (check.status === 'completed') { download_url = check.fileUrl; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!download_url) return { status: false };
    return { status: true, title: api.title, download_url };
  } catch { return { status: false }; }
}

async function ytdlv4(url, res) {
  try {
    const format = (res === 'audio' || res === 'mp3') ? 'mp3' : res;
    const data = await savetube.download(url, format);
    if (data && data.status && data.download_url) return { status: true, title: data.title || 'YouTube Media', download_url: data.download_url };
    return { status: false };
  } catch { return { status: false }; }
}

async function ytdlAuto(url, res) {
  let data = await ytdlv1(url, res);
  if (!data || !data.status || !data.download_url) data = await ytdlv4(url, res);
  if (!data || !data.status || !data.download_url) data = await ytdlv2(url, res);
  return data;
}

// ================= LOCATION CARD - NEXORA MD =================
async function sendLocationCard(sock, chat, quoted, info) {
  const res = await fetch(info.thumbnail, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`thumbnail fetch ${res.status}`);

  const jpegThumbnail = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(300, 300, { fit: 'inside' })
    .jpeg({ quality: 70 })
    .toBuffer();

  const msg = {
    locationMessage: {
      degreesLatitude: 0,
      degreesLongitude: 0,
      name: `🎵 ${info.title}`,
      address: `👤 ${info.channel} • ⏱️ ${info.duration} • 👁️ ${info.views}`,
      url: info.url,
      comment: 'NEXORA MD',
      jpegThumbnail,
      contextInfo: quoted?.key ? {
        stanzaId: quoted.key.id,
        participant: quoted.sender,
        quotedMessage: quoted.message,
      } : undefined,
    },
  };

  await sock.relayMessage(chat, msg, {});
}

// ================= CHANNEL FOLLOW + RGB TEXT CARD - NEXORA MD =================
async function getChannelInfo(info) {
  // The original looked the channel up with yt-search's channel search;
  // there is no house channel search, so the follow card uses the channel
  // data from the video's own search result (name, thumbnail, url).
  return { name: info.channel, image: info.thumbnail, url: info.channelUrl || info.url, subs: '' };
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendFollowCard(sock, chat, info) {
  const ch = await getChannelInfo(info);

  let img = '';
  try {
    const res = await fetch(info.thumbnail, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`thumbnail fetch ${res.status}`);
    const jpegThumbnail = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(480, 270, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
    img = `data:image/jpeg;base64,${jpegThumbnail.toString('base64')}`;
  } catch {}

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>NEXORA MD</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;background-color:transparent;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Cantarell,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.container{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:4px}
.rgb{display:block;width:100%;word-break:break-word;white-space:normal;color:#111}@media (prefers-color-scheme:dark){.rgb{color:#f1f1f1}}
.loc{position:relative;width:100%;margin-bottom:8px;border-radius:12px;overflow:hidden;background:rgba(127,127,127,.15)}.loc img{width:100%;display:block}.loc.pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:2rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}.loc.bar{padding:6px 10px;font-size:.78rem;font-weight:700}
.title{font-size:1.1rem;font-weight:800;line-height:1.25;margin-bottom:4px}
.meta{font-size:.85rem;font-weight:700;line-height:1.4;margin-bottom:2px}
.sign{font-size:.78rem;font-weight:700;letter-spacing:.5px;margin-top:6px;opacity:.8}
</style>
</head>
<body><div class="container">
${img ? `<div class="loc"><img src="${img}"><span class="pin">📍</span><div class="bar rgb">👤 ${escHtml(info.channel)}</div></div>` : ''}
<div class="rgb title">🎵 ${escHtml(info.title)}</div>
<div class="rgb meta">⏱️ ${escHtml(info.duration)} • 👁️ ${escHtml(info.views)}</div>
<div class="rgb meta">🔗 ${escHtml(info.url)}</div>
<span class="rgb sign">NEXORA MD</span>
</div></body>
</html>`;

  const id = crypto.randomUUID();
  const certificateChain = loadCertificateChain();
  const data = Buffer.from(JSON.stringify({
    response_id: id,
    sections: [
      {
        view_model: {
          primitive: {
            payload: html,
            url: 'https://nexora.dev',
            trusted_sources: ['nexora.dev'],
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
      },
      {
        view_model: {
          primitive: {
            __typename: 'GenAICompactEntityPrimitive',
            title: ch.name,
            subtitle: ch.subs || 'YouTube',
            secondary_subtitle: 'YouTube Channel',
            entity_id: info.id || info.url,
            entity_url: ch.url,
            entity_type: 'PAGE',
            action_type: 'FOLLOW',
            is_verified: false,
            image: { url: ch.image, url_fallback: ch.image },
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
      },
    ],
  })).toString('base64');

  await sock.relayMessage(chat, {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      botMetadata: {
        messageDisclaimerText: '',
        botResponseId: id,
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
          submessages: [{ messageType: 2, messageText: info.title }],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4,
          },
        },
      },
    },
  }, {});
}

export default {
  name: 'play3',
  aliases: ['yta2', 'ytmp32', 'ytmp42', 'ytmp5', 'ytmp6', 'ytv2'],
  category: 'download',
  description: 'YouTube audio/video downloader (alt). Usage: .play3 <title or URL> — .ytmp32/.ytmp42 for audio, .ytv2/.ytmp5/.ytmp6 for video.',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const q = args.join(' ').trim();
    const command = commandName || 'play3';
    const type = /mp3|audio|play/i.test(command) ? 'mp3' : 'mp4';
    if (!q) return m.reply(`*Example:*\n${prefix + command} https://youtu.be/xxx\n${prefix + command} latest dj`);

    await sock.sendMessage(m.from, { react: { text: '🕕', key: m.key } });

    try {
      let url = q;
      let info = null;
      const isUrl = /youtu\.be|youtube\.com/.test(q);

      if (!isUrl) {
        const search = await ytSearch(q, 1);
        if (!search.length) return m.reply(`❌ Not found: ${q}`);
        info = search[0];
      } else {
        const id = savetube.youtube(q);
        if (id) {
          try {
            // Keyless video details via YouTube's oEmbed endpoint (the
            // original used yt-search's videoId lookup; same fields).
            const oRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://youtu.be/${id}`)}&format=json`, { signal: AbortSignal.timeout(15000) });
            const o = oRes.ok ? await oRes.json().catch(() => null) : null;
            info = {
              title: o?.title || 'YouTube',
              channel: o?.author_name || 'Unknown',
              channelUrl: o?.author_url || '',
              duration: '0:00',
              views: '0',
              thumbnail: o?.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              url: `https://youtu.be/${id}`,
            };
          } catch {
            info = { title: 'YouTube', channel: '-', duration: '-', views: '-', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, url: `https://youtu.be/${id}` };
          }
        }
      }
      if (isUrl && info) url = info.url;

      if (type === 'mp3' && info) {
        try {
          await sendFollowCard(sock, m.from, info);
        } catch {
          try {
            await sendLocationCard(sock, m.from, m, info);
          } catch {
            const caption = `🎵 *${info.title}*\n👤 ${info.channel}\n⏱️ ${info.duration}\n👁️ ${info.views}\n🔗 ${info.url}\n\nNEXORA MD`;
            await sock.sendMessage(m.from, { image: { url: info.thumbnail }, caption }, { quoted: m });
          }
        }
      }

      const res = type === 'mp3' ? 'audio' : '720';
      const result = await ytdlAuto(url, res);

      if (!result || !result.status) {
        await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        return m.reply('❌ Download failed, try again.');
      }

      if (type === 'mp3') {
        const audioRes = await fetch(result.download_url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(120000),
        });
        if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
        const audioBuf = Buffer.from(await audioRes.arrayBuffer());
        await sock.sendMessage(m.from, { audio: audioBuf, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` }, { quoted: m });
      } else {
        await sock.sendMessage(m.from, { video: { url: result.download_url }, caption: `✅ *${result.title}*\n\nNEXORA MD`, mimetype: 'video/mp4' }, { quoted: m });
      }

      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    } catch (e) {
      await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } });
      m.reply(`❌ Error: ${e.message}`);
    }
  },
};
