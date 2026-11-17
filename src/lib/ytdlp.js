/**
 * @file src/lib/ytdlp.js
 *
 * yt-dlp bridge — the self-hosted YouTube extractor.
 *
 * Why this exists: every keyless hosted extractor we depended on is gone as of
 * 2026-11. The tioo `/youtube` route answers a 20-byte `{status:true}` with no
 * links, loader.to wants an API key, and the cobalt / Piped / Invidious family
 * either demands a JWT or has disabled the endpoint (all verified live
 * 2026-11-17). yt-dlp is already in the image for Instagram, so YouTube runs
 * through it too instead of through a dead host.
 *
 * YouTube now answers datacenter IPs with "Sign in to confirm you're not a
 * bot" on every player client (android, ios, tv, mweb, web_embedded — all
 * tested). That check is why cookies are supported: a cookies.txt exported
 * from a logged-in browser turns the same call into a normal extraction.
 *
 * Cookie resolution order (first hit wins):
 *   1. YOUTUBE_COOKIES_B64  base64 of cookies.txt → written to /tmp once
 *   2. YOUTUBE_COOKIES      path to a cookies.txt
 *   3. /app/data/cookies.txt  persisted on the Fly volume, uploadable without
 *                             a redeploy
 *
 * Set one with:
 *   fly secrets set YOUTUBE_COOKIES_B64="$(base64 -w0 cookies.txt)"
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

// Resolved per call, not at import: the path can be overridden at runtime
// (tests, and a machine where the binary lives somewhere else).
export const ytdlpBin = () => process.env.YTDLP_PATH || 'yt-dlp';

const COOKIE_TMP = '/tmp/nexora-yt-cookies.txt';
const COOKIE_VOLUME = '/app/data/cookies.txt';

let cookiePathCache;

/** Resolve the cookies file to pass to yt-dlp, or null when none is configured. */
export function resolveCookiePath() {
  if (cookiePathCache !== undefined) return cookiePathCache;

  const b64 = process.env.YOUTUBE_COOKIES_B64;
  if (b64) {
    try {
      fs.writeFileSync(COOKIE_TMP, Buffer.from(b64, 'base64').toString('utf8'), { mode: 0o600 });
      cookiePathCache = COOKIE_TMP;
      return cookiePathCache;
    } catch (err) {
      console.warn('[ytdlp] could not write cookies from YOUTUBE_COOKIES_B64:', err.message);
    }
  }

  const explicit = process.env.YOUTUBE_COOKIES;
  if (explicit && fs.existsSync(explicit)) {
    cookiePathCache = explicit;
    return cookiePathCache;
  }

  if (fs.existsSync(COOKIE_VOLUME)) {
    cookiePathCache = COOKIE_VOLUME;
    return cookiePathCache;
  }

  cookiePathCache = null;
  return cookiePathCache;
}

/** Forget the cached cookie path (used by tests and after uploading cookies). */
export function resetCookieCache() {
  cookiePathCache = undefined;
}

function cookieArgs() {
  const p = resolveCookiePath();
  return p ? ['--cookies', path.resolve(p)] : [];
}

/** An error whose `code` says what actually went wrong. */
function tagged(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Map yt-dlp stderr/stdout onto a reason we can show a user. */
function classify(output) {
  if (/Sign in to confirm you.?re not a bot/i.test(output)) {
    return tagged('BOT_CHECK', 'YouTube wants a signed-in session for this server IP (bot check)');
  }
  if (/Video unavailable|This video is unavailable|Private video/i.test(output)) {
    return tagged('UNAVAILABLE', 'that video is unavailable or private');
  }
  if (/age.?restricted|confirm your age/i.test(output)) {
    return tagged('AGE_RESTRICTED', 'that video is age-restricted');
  }
  if (/is not a valid URL|Unsupported URL/i.test(output)) {
    return tagged('BAD_URL', 'that link is not a supported YouTube URL');
  }
  const first = String(output).split('\n').find((l) => /ERROR|error/i.test(l));
  return tagged('EXTRACT_FAILED', (first || 'yt-dlp could not extract that video').slice(0, 200));
}

async function run(args, { timeoutMs = 90000 } = {}) {
  const stdout = await new Promise((resolve, reject) => {
    execFile(
      ytdlpBin(),
      args,
      { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs },
      (err, out, stderr) => {
        if (err) {
          if (err.code === 'ENOENT') return reject(tagged('NO_BINARY', 'yt-dlp is not installed'));
          if (err.killed) return reject(tagged('TIMEOUT', 'yt-dlp timed out'));
          return reject(classify(`${stderr || ''}\n${out || ''}\n${err.message || ''}`));
        }
        resolve(out);
      },
    );
  });
  return stdout;
}

/** Is yt-dlp present and runnable in this image? */
export async function ytdlpInfo() {
  try {
    const out = await run(['--version'], { timeoutMs: 15000 });
    return { present: true, version: String(out).trim(), cookies: !!resolveCookiePath() };
  } catch (err) {
    return { present: false, error: err.message, cookies: !!resolveCookiePath() };
  }
}

/**
 * Pick the best audio-only and video stream out of a yt-dlp info dump.
 *
 * Video is capped at 720p: YouTube happily offers 4K, and a 2160p file is
 * hundreds of MB, which WhatsApp refuses. m4a audio is preferred over Opus
 * when it is available because it is smaller at the same quality.
 */
export function pickStreams(info, { maxHeight = 720 } = {}) {
  const formats = (info?.formats || []).filter((f) => f && f.url);

  const audioOnly = formats.filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  const m4a = audioOnly.filter((f) => f.ext === 'm4a').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  const audio = m4a || audioOnly.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

  const videos = formats
    .filter((f) => f.vcodec && f.vcodec !== 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  const video = videos.find((f) => (f.height || 0) <= maxHeight) || videos[videos.length - 1];

  return { audio, video };
}

/**
 * Extract one YouTube URL (video, short or search result) without downloading.
 *
 * @param {string} url
 * @returns {Promise<{title,author,thumbnail,duration,mp3,mp4,mime,height}>}
 */
export async function ytdlpExtract(url, { timeoutMs = 90000 } = {}) {
  const stdout = await run(
    [
      '-j',
      '--no-warnings',
      '--ignore-config',
      '--no-playlist',
      '--socket-timeout', '20',
      ...cookieArgs(),
      url,
    ],
    { timeoutMs },
  );

  // yt-dlp prints one JSON object per entry, normally on a single line — but
  // not always (a pretty-printed dump is still valid). Try the whole body
  // first, then fall back to the first JSON line so neither shape is rejected.
  const body = String(stdout).trim();
  if (!body) throw tagged('EXTRACT_FAILED', 'yt-dlp returned no metadata');
  let info;
  try {
    info = JSON.parse(body);
  } catch {
    const line = body.split('\n').find((l) => l.trim().startsWith('{'));
    if (!line) throw tagged('EXTRACT_FAILED', 'yt-dlp returned no JSON metadata');
    try {
      info = JSON.parse(line);
    } catch {
      throw tagged('EXTRACT_FAILED', 'yt-dlp returned unreadable metadata');
    }
  }
  const { audio, video } = pickStreams(info);
  if (!audio && !video) throw tagged('NO_STREAMS', 'yt-dlp found no downloadable stream');

  return {
    title: info.title,
    author: info.uploader || info.channel,
    thumbnail: info.thumbnail,
    duration: info.duration,
    mp3: audio?.url,
    mp3Mime: audio?.ext === 'webm' ? 'audio/webm' : 'audio/mp4',
    mp4: video?.url,
    height: video?.height,
    usedCookies: !!resolveCookiePath(),
  };
}

export default ytdlpExtract;
