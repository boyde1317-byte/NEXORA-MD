/**
 * ytmp3gg.js — .ytmp3gg — YouTube → MP3 via the convert1s hub.
 *
 * Ported from the LUNA MD commands/downloader/ytmp3gg.js. Logic kept
 * as-is: create a conversion job, poll the status URL (up to ~2 min),
 * then download the MP3 with a 15 MB cap and send it as audio.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch
 *     (axios is not a direct NexoraFlex dependency).
 *   - `ctx.id` / `ctx.sock` -> `m.from` / `sock` from the execute context.
 *   - Branding: NEXORA MD.
 */
const HUB = 'https://hub.convert1s.com';
const TIMEOUT_MS = 30000;
const POLL_MS = 3000;
const POLL_MAX = 40; // 40 x 3s = ~2 minutes
const MAX_RETRY = 2;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const REFERER = 'https://media.ytmp3.gg/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jsonHeaders() {
  return {
    'User-Agent': UA,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Referer: REFERER,
    Origin: 'https://media.ytmp3.gg',
  };
}

function extractVideoId(input) {
  const s = String(input || '').trim();
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(s);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  try { return JSON.parse(text); } catch (_) { return {}; }
}

async function createJob(videoId, bitrate = '128k') {
  let last = null;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const data = await fetchJson(`${HUB}/api/download`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          os: 'windows',
          output: { type: 'audio', format: 'mp3' },
          audio: { bitrate },
        }),
      });
      if (data && data.statusUrl && data.title) return data;
      last = new Error(data?.message || data?.error || 'The server did not return a statusUrl.');
    } catch (e) { last = e; }
    if (attempt < MAX_RETRY) await sleep(1500 * attempt);
  }
  throw last || new Error('Failed to create the conversion job.');
}

async function pollJob(statusUrl) {
  for (let i = 0; i < POLL_MAX; i++) {
    let data = null;
    try {
      data = await fetchJson(statusUrl, {
        headers: { 'User-Agent': UA, Accept: 'application/json', Referer: REFERER },
      });
    } catch (_) {}
    if (data?.downloadUrl) return data;
    if (data?.status === 'error') throw new Error(data.jobError || data.error || 'Conversion failed on the server.');
    await sleep(POLL_MS);
  }
  throw new Error('Timed out waiting for conversion (2 minutes).');
}

async function requestMp3(videoId, bitrate = '128k') {
  try {
    const job = await createJob(videoId, bitrate);
    const done = await pollJob(job.statusUrl);
    return { ok: true, title: done.title || job.title || '', link: done.downloadUrl, duration: done.duration || job.duration || null };
  } catch (e) { return { ok: false, why: e.message || String(e) }; }
}

async function downloadMp3(link, maxBytes = MAX_BYTES) {
  const res = await fetch(link, {
    headers: { 'User-Agent': UA, Referer: REFERER },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Audio file is empty.');
  if (buf.length > maxBytes) throw new Error(`Audio is over the 15 MB cap (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
  return buf;
}

export default {
  name: 'ytmp3gg',
  aliases: [],
  category: 'download',
  description: 'Download MP3 audio from YouTube (15 MB cap). Usage: .ytmp3gg <YouTube link>',
  cooldown: 15000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const url = args[0];
    if (!url) return await m.reply(`⚠️ Send the YouTube link!\nExample: *${p}ytmp3gg https://youtu.be/xxx*`);
    const videoId = extractVideoId(url);
    if (!videoId) return await m.reply('❌ Invalid YouTube link!');
    await m.reply('⏳ _Downloading the audio, please wait a moment..._');
    try {
      const result = await requestMp3(videoId);
      if (!result.ok) return await m.reply(`❌ Failed to process: ${result.why}`);
      const audioBuffer = await downloadMp3(result.link);
      await sock.sendMessage(m.from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
      await m.reply(`🎵 *Download successful!*\nTitle: ${result.title}`);
    } catch (error) {
      console.error('[YTMP3GG Error]:', error);
      await m.reply(`⚠️ An error occurred while downloading: ${error.message}`);
    }
  },
};
