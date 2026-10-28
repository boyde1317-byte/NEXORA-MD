/**
 * @file src/lib/downloader.js
 * Thin, transparent fetch wrappers around live scraper/downloader endpoints.
 *
 * Design choice: rather than pulling in a third-party npm scraper package
 * (several on npm ship obfuscated code or dead endpoints), we call the same
 * backend those packages wrap directly with native `fetch`, matching the
 * rest of the codebase's HTTP convention (see ssweb.js).
 *
 * Resilience: the downloader tries multiple backend hosts in order — if the
 * primary is down, it automatically falls through to the fallback before
 * surfacing the error to the caller.
 *
 * All functions:
 *  - throw a plain Error with a human-readable message on failure (never
 *    silently return null/undefined on error — callers decide how to present it)
 *  - apply a request timeout via AbortSignal
 *  - return plain JS objects/arrays, already unwrapped from each endpoint's
 *    particular response envelope
 */

// ── Backend endpoints ─────────────────────────────────────────────────────────
// Primary + fallback backends for download commands. If the primary goes down,
// we automatically retry on the fallback before surfacing the error.
// api.tioo.eu.org was REMOVED 2026-09-15: it stopped responding entirely
// (every request times out), so it only added ~20s of dead wait to every
// retry cycle. backend2/3/4 verified live (ttdl + fbdown both answer).
const BACKENDS = [
  'https://backend1.tioo.eu.org',
  'https://backend2.tioo.eu.org',
  'https://backend3.tioo.eu.org',
  'https://backend4.tioo.eu.org',
];
// 8s per host was tight enough that a slow-but-healthy route (/yts under load,
// which aborts a whole search) read as an outage. 12s plus a hard wall-clock
// budget below keeps the worst case bounded without inventing failures.
const DEFAULT_TIMEOUT = 12000;
// Some routes are far slower than the rest (the /spotify extraction measures
// 12-22s per host — it transcodes server-side). With the 8s default every
// single .spotify call aborted on every host, including the one that had the
// track, so the command could never succeed. Slow routes opt into this.
const SLOW_TIMEOUT = 35000;

/**
 * getJson2 — plain JSON fetch with a semantic validator and timeout.
 * Used for non-tioo endpoints (loader.to) that need no host failover.
 */
async function getJson2(path, validate) {
  const res = await fetch(path, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (validate && !validate(json)) throw new Error('unexpected response shape');
  return json;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** True if the given text looks like a public http(s) URL. */
export const isUrl = (s) => {
  const trimmed = (s || '').trim();
  if (!/^https?:\/\/.{3,}/i.test(trimmed)) return false;
  // Block private/internal IPs to prevent SSRF
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' || host.endsWith('.local') ||
      host === '169.254.169.254' || host === '0.0.0.0' ||
      /^127\./.test(host) || /^10\./.test(host) ||
      /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
  } catch (_) { return false; }
  return true;
};

/**
 * getJson — fetch a downloader-API route with host failover.
 *
 * opts.validate: optional semantic validator. A 200 JSON body can still be
 * a "dead" extraction — e.g. Facebook rate-limits repeat scrapes of the
 * same URL and the backend answers { status: true, Normal_video: null }.
 * Without the validator that empty result was returned as success and the
 * caller threw a dead-end error while other hosts could still have the
 * cached extraction. validate(body) → false now counts as a backend
 * failure so the loop walks to the next host before giving up.
 */
async function getJson(path, { timeout = DEFAULT_TIMEOUT, validate } = {}) {
  const MAX_RETRIES = 2;  // try each backend up to 2 times (2 × hosts attempts)
  const RETRY_DELAY = 1500;  // ms between retries
  // Wall-clock ceiling for the whole call. Without it, 4 hosts x 2 attempts x
  // a slow timeout stacks into minutes of dead waiting on a real outage.
  const budgetMs = timeout * 3;
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    for (const base of BACKENDS) {
      if (Date.now() - startedAt > budgetMs) break;
      try {
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeout) });
        if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}.`);
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('json')) throw new Error('Non-JSON response — the link may be invalid or unsupported.');
        const body = await res.json();
        // A JSON *string* is a failure envelope, not data. The tioo family
        // answers `/igdl` with the bare body "Request Failed With Code 401"
        // (HTTP 200, content-type json). That passed every check above and
        // was returned as a "successful" extraction, so the host-failover
        // loop never advanced and the caller blamed the user's link.
        if (body === null || typeof body !== 'object') {
          throw new Error(`Backend returned a plain-text failure ("${String(body).slice(0, 80)}").`);
        }
        if (validate && !validate(body)) {
          throw new Error('Backend returned an empty extraction result.');
        }
        // Sticky host: put the backend that just worked at the front of the
        // list, so a slow/partial host is not re-probed on every request.
        const idx = BACKENDS.indexOf(base);
        if (idx > 0) {
          BACKENDS.splice(idx, 1);
          BACKENDS.unshift(base);
        }
        return body;
      } catch (err) {
        lastError = err;
        // Try next backend immediately, then retry cycle after delay
      }
    }
    // All backends failed this attempt — wait before retrying
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
  // Carry the reason through: callers map specific messages (e.g. the
  // Facebook "private / rate-limited" hint) and could never match the old
  // generic wording, so every real cause was flattened into
  // "Download failed after 2 attempts."
  const reason = lastError?.message ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Download failed after ${MAX_RETRIES} attempts. The backend may be temporarily unavailable — try again in a moment.${reason}`);
}

/** YouTube search (used by .play / .ytmp4 without a direct URL). */
export async function youtubeSearch(query) {
  const data = await getJson(`/yts?url=${encodeURIComponent(query)}`);
  const list = data?.all || data?.result || [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('No YouTube results found for that search.');
  return list.map(v => ({
    videoId: v.videoId,
    url: v.url || (v.videoId ? `https://youtube.com/watch?v=${v.videoId}` : undefined),
    title: v.title,
    thumbnail: v.thumbnail,
    // yt-search returns duration as {seconds, timestamp} — surface the
    // display string ("3:16"), never the raw object ([object Object]
    // leaked into every .play/.ytmp4 picker row + card header).
    duration: v.duration?.timestamp || v.duration || v.timestamp,
    views: v.views,
    author: v.author?.name || v.author,
  })).filter(v => v.url);
}

/**
 * YouTube video → direct mp3 + mp4 links, by URL.
 *
 * The tioo /youtube route started returning a bare {status:true} with no
 * links at all (YouTube extraction dead across all four tioo hosts since
 * ~2026-09-19 — every .play/.ytmp3 "No audio stream available"). A 200
 * with status:true looked "successful" to the failover loop, so it never
 * tried anything else. Now we treat empty-link responses as failures and
 * fall through to loader.to's two-step API:
 *   1. GET /ajax/download.php?format=mp3&url=… → {id, progress_url}
 *   2. poll progress_url every 2s (up to ~40s) → {success, download_url}
 * loader.to links are short-lived, same as the old ymcdn tokens — callers
 * already buffer immediately, which is why we kept that contract.
 */
export async function youtubeDownload(url, { preferMp4 = false } = {}) {
  // ── Primary: tioo family (works again if their extractor recovers) ──
  try {
    const data = await getJson(`/youtube?url=${encodeURIComponent(url)}`);
    // A 200/status:true body with NO links is the new dead-extractor
    // shape — count it as a failure instead of a success.
    const alive = data?.status && (data.mp3 || data.mp4);
    if (alive) {
      return {
        title: data.title,
        author: data.author,
        thumbnail: data.thumbnail,
        mp4: data.mp4,
        mp3: data.mp3,
      };
    }
  } catch (_) { /* primary down/empty — fall through to loader.to */ }

  // ── Fallback: loader.to two-step ──────────────────────────────────
  const viaLoader = await loaderToDownload(url, preferMp4 ? '360' : 'mp3');
  if (!viaLoader) {
    throw new Error('YouTube extraction is down on both sources right now (the fallback now requires an API key). Try again in a few minutes.');
  }
  return viaLoader;
}

/**
 * loader.to two-step download. Returns the same shape as the tioo route
 * (mp3 in .mp3, video in .mp4) or null when the job never produced a URL.
 */
async function loaderToDownload(url, format) {
  // NOTE: loader.to now answers `{error_code:"api_key_required"}` for
  // keyless server-side use, so this fallback is effectively dead unless an
  // API key is configured. The validator makes it fail fast (no 40s poll)
  // instead of hanging; the caller's error message says so.
  const start = await getJson2(
    `https://loader.to/ajax/download.php?format=${format}&url=${encodeURIComponent(url)}`,
    (j) => !!(j?.success && j?.progress_url),
  ).catch(() => null);
  if (!start) return null;

  // Poll the progress endpoint until the download URL appears.
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const p = await getJson2(start.progress_url, (j) => j && typeof j === 'object')
      .catch(() => null);
    if (p?.success === 1 && p?.download_url) {
      return {
        title: null,
        author: null,
        thumbnail: null,
        mp3: format === 'mp3' ? p.download_url : undefined,
        mp4: format !== 'mp3' ? p.download_url : undefined,
      };
    }
  }
  return null;
}

// ── Self-hosted fallback (yt-dlp) ─────────────────────────────────────────────
// The tioo family proxies a shared rapidapi key for Instagram. When that quota
// is spent, every host answers the same HTTP 200 + "Request Failed With Code
// 401" body, so no amount of host failover helps. yt-dlp extracts public
// Instagram posts directly and needs no key — verified logged-out on live
// reels and photo posts. It is optional: if the binary is absent (local dev)
// the bridge simply reports itself unavailable and the provider error stands.
const YTDLP_BIN = process.env.YTDLP_PATH || 'yt-dlp';

async function ytDlpJson(url, { timeoutMs = 90000 } = {}) {
  const { execFile } = await import('node:child_process');
  const stdout = await new Promise((resolve, reject) => {
    execFile(
      YTDLP_BIN,
      ['-j', '--no-warnings', '--ignore-config', '--socket-timeout', '20', url],
      { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs },
      (err, out) => {
        if (err) {
          const why = err.code === 'ENOENT' ? 'yt-dlp not installed' : (err.message || 'yt-dlp failed');
          return reject(new Error(why));
        }
        resolve(out);
      },
    );
  });
  // A photo carousel prints one JSON object per line (one per item).
  return String(stdout).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Pick the best downloadable asset out of one yt-dlp entry. */
function pickYtDlpAsset(entry) {
  if (!entry) return null;
  const formats = (entry.formats || []).filter((f) => f && f.url);
  const bestVideo = formats
    .filter((f) => f.vcodec && f.vcodec !== 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  const url = bestVideo?.url || entry.url;
  if (!url) return null;
  return {
    thumbnail: entry.thumbnail,
    url,
    resolution: entry.width && entry.height ? `${entry.width}x${entry.height}` : undefined,
    isVideo: !!(bestVideo || entry.ext === 'mp4' || (entry.vcodec && entry.vcodec !== 'none')),
    title: entry.title,
  };
}

async function instagramViaYtDlp(url) {
  const entries = await ytDlpJson(url);
  const assets = entries.map(pickYtDlpAsset).filter(Boolean);
  if (!assets.length) throw new Error('yt-dlp found no media on that post');
  return assets;
}

// WhatsApp rejects/stalls on very large video payloads, and X happily offers
// 70MB 1080p variants. Pick the best variant that still fits.
const MAX_SEND_BYTES = 60 * 1024 * 1024;

async function contentLengthOf(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return Number(r.headers.get('content-length') || 0);
  } catch (_) {
    return 0; // unknown → treat as acceptable
  }
}

/** Highest-quality variant that still fits under MAX_SEND_BYTES. */
async function bestFittingVariant(urls) {
  for (const u of urls) {
    const size = await contentLengthOf(u);
    if (!size || size <= MAX_SEND_BYTES) return { url: u, size };
  }
  return { url: urls[urls.length - 1], size: 0 };
}

// ── fxtwitter (keyless X/Twitter source) ─────────────────────────────────────
// Secondary source for X. Returns the direct video.twimg.com URL plus metadata,
// with no key and no rate-limited proxy in between.
async function twitterViaFx(url) {
  const m = String(url).match(/status(?:es)?\/(\d+)/i);
  if (!m) throw new Error('not a status link');
  const handle = String(url).match(/(?:x|twitter)\.com\/([^/]+)\/status/i)?.[1];
  const path = handle && !/^i$|^web$/i.test(handle) ? `${handle}/status/${m[1]}` : `status/${m[1]}`;
  const data = await getJson2(
    `https://api.fxtwitter.com/${path}`,
    (j) => !!(j?.code === 200 && j?.tweet),
  );
  const media = data.tweet.media || {};
  const video = (media.videos || [])[0];
  if (!video?.url) throw new Error('that post has no video');
  return {
    title: data.tweet.text || '',
    url: video.url,
    thumbnail: video.thumbnail_url,
    author: data.tweet.author?.screen_name ? `@${data.tweet.author.screen_name}` : undefined,
  };
}

/** TikTok video → direct (no-watermark) video/audio links. */
export async function tiktokDownload(url) {
  const data = await getJson(`/ttdl?url=${encodeURIComponent(url)}`, {
    // Require actual media, not just a success flag: a degraded host answers
    // {status:true, video:[], audio:[]}, which used to satisfy the validator
    // and end the host walk while healthy backends still had the video.
    validate: (j) => !!((j?.video?.length) || (j?.audio?.length) || (j?.images?.length) || (j?.photos?.length)),
  });
  const videos = data.video || [];
  const audios = data.audio || [];
  // Photo-post slideshows: the ttdl endpoint returns an image array for them.
  const images = data.images || data.photos || [];
  if (videos.length === 0 && images.length === 0) throw new Error('TikTok returned no downloadable video for that link — it may have been removed or is private.');
  return {
    images,
    title: data.title,
    // `creator` is the uploader's actual username. `title_audio` is NOT an
    // author field at all — it's the sound/music track title (usually just
    // the video's caption + " (audio)"), so it was showing the same long
    // caption text (truncated mid-word) as the "Author" on every card.
    // `creator` on the live endpoint is the API vendor's handle ("@prm2.0"),
    // not the uploader — every TikTok card was crediting the API reseller.
    // Only trust it when it does not look like a known vendor handle.
    author: (data.creator && !/^@?prm2/i.test(String(data.creator).trim()))
      ? data.creator
      : (data.author_name || data.username || data.nickname || null),
    thumbnail: data.thumbnail,
    video: videos[0],
    audio: audios[0],
  };
}

/**
 * Instagram post/reel/story → direct media links.
 *
 * Two sources: the tioo route, then yt-dlp. The route is quota-based (its
 * shared upstream answers 401 once spent) and does not recover by switching
 * hosts, which is why it needs a real second source rather than more retries.
 */
export async function instagramDownload(url) {
  let primaryError;
  try {
    const data = await getJson(`/igdl?url=${encodeURIComponent(url)}`);
    const list = Array.isArray(data) ? data : (data?.data || []);
    const mapped = list.map(item => ({
      thumbnail: item.thumbnail,
      url: item.url,
      resolution: item.resolution,
    })).filter(i => i.url);
    if (mapped.length) return mapped;
    primaryError = new Error('the scraper returned no media');
  } catch (err) {
    primaryError = err;
  }

  try {
    const viaYtDlp = await instagramViaYtDlp(url);
    if (viaYtDlp.length) return viaYtDlp;
  } catch (_) { /* fall through with the provider error */ }

  if (/401/i.test(primaryError.message)) {
    throw new Error('the shared Instagram scraper is rate-limited right now (HTTP 401) and the local fallback could not read it either — try again in a few minutes.');
  }
  throw new Error(`Could not fetch that Instagram link. It may be private or invalid. (${primaryError.message})`);
}

/** Facebook video → direct (SD + HD) links. */
export async function facebookDownload(url) {
  // Facebook rate-limits repeat scrapes of the same URL — extraction
  // intermittently comes back with status:true but null links. The
  // validator makes those count as failures so the host-failover loop
  // can pick up a cached extraction from a different backend.
  const data = await getJson(`/fbdown?url=${encodeURIComponent(url)}`, {
    validate: (j) => !!(j?.status && (j.Normal_video || j.HD || j.Hd_video)),
  }).catch((err) => {
    if (String(err.message).includes('empty extraction')) {
      throw new Error('Facebook returned no video for that link — it may be private, deleted, or rate-limited. Try again in a moment.');
    }
    throw err;
  });
  return {
    sd: data.Normal_video,
    hd: data.HD || data.Hd_video,
  };
}

/**
 * Twitter/X post → direct video/media links.
 *
 * Two sources: the tioo route, then fxtwitter. Empty media objects from the
 * route ({url:[{},{}]}, which it also returns when its own quota is spent)
 * count as a miss so the second source gets a turn.
 */
export async function twitterDownload(url) {
  let primaryError;
  try {
    const data = await getJson(`/twitter?url=${encodeURIComponent(url)}`);
    const links = (data?.url || []).filter(u => u && (u.hd || u.sd || u.url));
    if (data?.status && links.length) {
      // Variants come back smallest-first in no guaranteed order; taking the
      // last one handed out 640x360 for a video that had a 1280x720 version.
      const area = (u) => {
        const m = String(u.hd || u.sd || u.url || '').match(/\/(\d{2,4})x(\d{2,4})\//);
        return m ? Number(m[1]) * Number(m[2]) : 0;
      };
      const ranked = [...links]
        .sort((a, b) => area(b) - area(a))
        .map((u) => u.hd || u.sd || u.url)
        .filter(Boolean);
      const { url } = await bestFittingVariant(ranked);
      return {
        title: data.title,
        url,
      };
    }
    primaryError = new Error('the scraper returned no media for that post');
  } catch (err) {
    primaryError = err;
  }

  try {
    return await twitterViaFx(url);
  } catch (fxErr) {
    throw new Error(`Could not fetch media from that X/Twitter post. It may not contain a video, or the link is invalid. (${primaryError.message}; fallback: ${fxErr.message})`);
  }
}

/** Spotify track → direct mp3 download link. */
export async function spotifyDownload(url) {
  // /spotify is the slowest route on the whole family (server-side transcode,
  // measured 12-22s). It needs SLOW_TIMEOUT or it aborts on every host.
  const data = await getJson(`/spotify?url=${encodeURIComponent(url)}`, {
    timeout: SLOW_TIMEOUT,
    validate: (j) => !!(j?.status && j?.res_data?.formats?.[0]?.url),
  });
  const res = data?.res_data;
  const format = res?.formats?.[0];
  if (!data?.status || !format?.url) throw new Error('Could not fetch that Spotify track. Check the link and try again.');
  return {
    title: res.title,
    thumbnail: res.thumbnail,
    duration: res.duration,
    url: format.url,
  };
}

/** Pinterest search (by query) → list of pin images. */
export async function pinterestSearch(query) {
  const data = await getJson(`/pinterest?url=${encodeURIComponent(query)}`, {
    validate: (j) => !!(j?.success && (j?.result?.result || []).length),
  });
  const list = data?.result?.result || [];
  if (!data?.success || list.length === 0) throw new Error('No Pinterest results found for that search.');
  return list.map(p => ({
    title: p.title,
    image: p.image_url,
    pinUrl: p.pin_url,
  })).filter(p => p.image);
}

/** APK search via Aptoide's public catalog search. */
export async function apkSearch(query) {
  const res = await fetch(
    `https://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=8`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) },
  );
  if (!res.ok) throw new Error(`APK catalog returned HTTP ${res.status}.`);
  const data = await res.json();
  const list = data?.datalist?.list || [];
  if (list.length === 0) throw new Error('No APKs found for that search.');
  return list.map(a => ({
    name: a.name,
    packageName: a.package,
    version: a.file?.vername,
    size: a.size,
    icon: a.icon,
    downloads: a.stats?.downloads,
    rating: a.stats?.rating?.avg,
    url: a.file?.path || a.file?.path_alt,
  })).filter(a => a.url);
}

/** General web "quick facts" search via DuckDuckGo's official Instant Answer API (no key). */
export async function webSearch(query) {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) },
  );
  if (!res.ok) throw new Error(`Search backend returned HTTP ${res.status}.`);
  const data = await res.json();
  const related = (data.RelatedTopics || [])
    .flatMap(t => t.Topics ? t.Topics : [t])
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (!data.AbstractText && related.length === 0) {
    throw new Error('No quick results found for that search.');
  }

  return {
    heading: data.Heading || query,
    abstract: data.AbstractText,
    source: data.AbstractSource,
    sourceUrl: data.AbstractURL,
    image: data.Image ? `https://duckduckgo.com${data.Image}` : undefined,
    related,
  };
}

/** Current weather for a city via wttr.in's JSON API (no key). */
export async function getWeather(city) {
  const res = await fetch(
    `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT), headers: { 'User-Agent': 'curl/8' } },
  );
  if (!res.ok) throw new Error(`Weather service returned HTTP ${res.status}.`);
  const data = await res.json();
  const cur = data?.current_condition?.[0];
  const area = data?.nearest_area?.[0];
  if (!cur) throw new Error('Could not find weather for that location.');
  return {
    location: [area?.areaName?.[0]?.value, area?.country?.[0]?.value].filter(Boolean).join(', ') || city,
    description: cur.weatherDesc?.[0]?.value || 'Unknown',
    tempC: cur.temp_C,
    tempF: cur.temp_F,
    feelsLikeC: cur.FeelsLikeC,
    feelsLikeF: cur.FeelsLikeF,
    humidity: cur.humidity,
    windKmph: cur.windspeedKmph,
  };
}

/** Text translation via Google Translate's public (unofficial, keyless) endpoint. */
export async function translateText(text, targetLang) {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) },
  );
  if (!res.ok) throw new Error(`Translation service returned HTTP ${res.status}.`);
  const data = await res.json();
  const translated = (data?.[0] || []).map(chunk => chunk[0]).join('');
  const detectedFrom = data?.[2];
  if (!translated) throw new Error('Could not translate that text.');
  return { text: translated, from: detectedFrom || 'auto' };
}

/** Wikipedia summary lookup via Wikipedia's official search API (no key). */
export async function wikiSearch(query) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) },
  );
  if (!res.ok) throw new Error(`Wikipedia returned HTTP ${res.status}.`);
  const data = await res.json();
  const hit = data?.query?.search?.[0];
  if (!hit) throw new Error('No Wikipedia article found for that topic.');
  const snippet = hit.snippet.replace(/<[^>]+>/g, '');
  return {
    title: hit.title,
    snippet,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
  };
}

/** Song lyrics via lyrics.ovh's public API (no key). */
export async function getLyrics(artist, title) {
  const res = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) },
  );
  if (res.status === 404) throw new Error(`No lyrics found for "${title}" by ${artist}.`);
  if (!res.ok) throw new Error(`Lyrics service returned HTTP ${res.status}.`);
  const data = await res.json();
  if (!data?.lyrics) throw new Error(`No lyrics found for "${title}" by ${artist}.`);
  return data.lyrics.trim();
}

/**
 * Re-encode a downloaded audio track into a container WhatsApp can actually
 * play.
 *
 * Why: the YouTube route hands back itag 249 — Opus inside a WebM container
 * (verified: bytes start 1a 45 df a3, content-type audio/webm). Sending that
 * with `mimetype: 'audio/mpeg'` is a lie the client detects, which surfaces
 * on-device as "this audio is not available because something is wrong with
 * the audio file". Anything that is not a container WhatsApp natively plays
 * (mpeg/mp4/aac/ogg-opus/amr) gets re-encoded with ffmpeg (already in the
 * image). On any ffmpeg failure the original bytes are returned unchanged so
 * the command still has a chance of playing.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype  the mimetype the source actually served
 * @returns {Promise<{buffer: Buffer, mimetype: string}>}
 */
export async function whatsappAudioBuffer(buffer, mimetype = '') {
  const playable = /^audio\/(mpeg|mp3|mp4|aac|ogg|opus|amr|x-m4a)/i.test(mimetype) ||
                   /^audio\/ogg/i.test(mimetype);
  if (playable) return { buffer, mimetype };

  try {
    const { execFile } = await import('node:child_process');
    const out = await new Promise((resolve, reject) => {
      const child = execFile(
        'ffmpeg',
        ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
         '-vn', '-acodec', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'],
        { encoding: 'buffer', maxBuffer: 200 * 1024 * 1024, timeout: 120000 },
        (err, stdout) => (err ? reject(err) : resolve(stdout)),
      );
      child.stdin.on('error', () => {});
      child.stdin.end(buffer);
    });
    if (!out || !out.length) throw new Error('ffmpeg produced no output');
    return { buffer: out, mimetype: 'audio/mpeg' };
  } catch (err) {
    console.warn('[downloader] audio transcode failed, sending source bytes:', err.message);
    return { buffer, mimetype: /^audio\//i.test(mimetype) ? mimetype : 'audio/mpeg' };
  }
}

/**
 * Sniff whether a tokenised CDN link is video or image.
 * These links carry no extension and answer `application/octet-stream`, so
 * extension heuristics misclassify every Instagram reel as an image.
 */
export async function sniffIsVideo(url) {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-15' }, signal: AbortSignal.timeout(12000) });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.startsWith('video/')) return true;
    if (ct.startsWith('image/')) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 12) return false;
    if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;   // mp4/mov
    if (buf.slice(0, 4).toString('ascii') === 'RIFF') return false;  // webp
    return false;
  } catch (_) {
    return /\.mp4(\?|$)/i.test(url);
  }
}

/**
 * Single Pinterest pin → image URLs.
 *
 * `/pinterest` on the backend is a *keyword search*, so passing a pin URL to
 * it (as the smart downloader did) returned unrelated results or nothing.
 * A pin page carries its own originals-sized image in the HTML, which is what
 * `.download <pin link>` actually needs.
 */
export async function pinterestPin(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Pinterest returned HTTP ${res.status}.`);
  const html = await res.text();
  const hits = [...html.matchAll(/https:\/\/i\.pinimg\.com\/(?:originals|1200x)\/[A-Za-z0-9\/._-]+\.(?:jpg|jpeg|png|webp)/g)]
    .map(m => m[0]);
  const unique = [...new Set(hits)];
  if (!unique.length) throw new Error('Could not find an image on that Pinterest pin.');
  return unique.slice(0, 10);
}

export default {
  youtubeSearch,
  youtubeDownload,
  tiktokDownload,
  instagramDownload,
  facebookDownload,
  twitterDownload,
  spotifyDownload,
  pinterestSearch,
  pinterestPin,
  apkSearch,
  webSearch,
  getWeather,
  translateText,
  wikiSearch,
  getLyrics,
  whatsappAudioBuffer,
  sniffIsVideo,
};

/**
 * Fetch a media URL into a buffer, following redirects.
 *
 * Why: downloader backends (e.g. c.ymcdn.org) hand out short-lived,
 * single-token stream URLs. Handing the raw URL to baileys means the fetch
 * happens later — by which time the token can already be 410 Gone
 * ("Failed to fetch stream from ..."). Buffering immediately, right after
 * the backend response, decouples the send from the token's lifetime.
 *
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
export async function downloadMediaBuffer(url, { timeoutMs = 60000, maxBytes = 100 * 1024 * 1024 } = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!response.ok) {
    throw new Error(`stream fetch failed (HTTP ${response.status})`);
  }
  const len = Number(response.headers.get('content-length') || 0);
  if (len && len > maxBytes) {
    throw new Error(`file too large (${(len / 1024 / 1024).toFixed(1)} MB, limit ${(maxBytes / 1024 / 1024)} MB)`);
  }
  const mimetype = (response.headers.get('content-type') || '').split(';')[0].trim() || 'application/octet-stream';
  // A 502/503 from the CDN's own edge (Cloudflare et al.) sometimes rides in
  // on a "soft" 200 — an HTML/JSON error page instead of a real HTTP error
  // code. response.ok alone misses that. Reject those content-types outright
  // rather than let a caller force a media mimetype onto an error page (see
  // isPlausibleMedia below for the belt-and-suspenders byte-level check too).
  if (/^(text\/html|text\/plain|application\/json|application\/xml|text\/xml)/i.test(mimetype)) {
    throw new Error(`stream returned ${mimetype} instead of media — the source is likely down or the link expired`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('empty stream');
  if (buffer.length > maxBytes) throw new Error(`file too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  return { buffer, mimetype };
}

/**
 * Belt-and-suspenders check before a caller force-labels an ambiguous
 * content-type as a specific media mimetype (e.g. play.js falling back to
 * 'audio/mpeg' for any non-'audio/*' content-type). Recognizes magic bytes
 * for the formats these download commands actually produce. Returns false
 * for anything that looks like text (HTML/JSON/XML) even if it slipped past
 * the content-type gate above — never ships an error page as "media".
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isPlausibleMedia(buffer) {
  if (!buffer || buffer.length < 4) return false;
  const head = buffer.subarray(0, 16);
  const text = head.toString('utf8').trimStart();
  if (text.startsWith('<') || text.startsWith('{') || text.startsWith('[')) return false; // html/xml/json
  // MP3: ID3 tag, or an MPEG frame sync (0xFFEx-0xFFFx after masking the low bits we don't care about)
  if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true; // 'ID3'
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return true; // MPEG frame sync
  // MP4/M4A/MOV family: 'ftyp' box at offset 4
  if (head.length >= 8 && head.subarray(4, 8).toString('ascii') === 'ftyp') return true;
  // WebM/Matroska: EBML header
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
  // OGG (Opus/Vorbis)
  if (head.subarray(0, 4).toString('ascii') === 'OggS') return true;
  // WAV: 'RIFF' ... 'WAVE'
  if (head.subarray(0, 4).toString('ascii') === 'RIFF') return true;
  // Unrecognized binary — don't block formats we haven't enumerated; only
  // text-shaped bodies are rejected above.
  return true;
}
