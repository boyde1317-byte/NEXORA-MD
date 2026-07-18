/**
 * @file src/lib/downloader.js
 * Thin, transparent fetch wrappers around live scraper/downloader endpoints.
 *
 * Design choice: rather than pulling in a third-party npm scraper package
 * (several on npm ship obfuscated code or dead endpoints), we call the same
 * backend those packages wrap (`https://backend1.tioo.eu.org`) directly with
 * native `fetch`, matching the rest of the codebase's HTTP convention (see
 * ssweb.js). Every endpoint below has been live-verified.
 *
 * All functions:
 *  - throw a plain Error with a human-readable message on failure (never
 *    silently return null/undefined on error — callers decide how to present it)
 *  - apply a request timeout via AbortSignal
 *  - return plain JS objects/arrays, already unwrapped from each endpoint's
 *    particular response envelope
 */

const BASE = 'https://backend1.tioo.eu.org';
const DEFAULT_TIMEOUT = 20000;

/** True if the given text looks like an http(s) URL. */
export const isUrl = (s) => /^https?:\/\/.{3,}/i.test((s || '').trim());

async function getJson(path, { timeout = DEFAULT_TIMEOUT } = {}) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Downloader backend returned HTTP ${res.status}.`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) throw new Error('Downloader backend returned an unexpected (non-JSON) response — the link may be invalid or unsupported.');
  return res.json();
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
    duration: v.duration || v.timestamp,
    views: v.views,
    author: v.author?.name || v.author,
  })).filter(v => v.url);
}

/** YouTube video → direct mp3 + mp4 links, by URL. */
export async function youtubeDownload(url) {
  const data = await getJson(`/youtube?url=${encodeURIComponent(url)}`);
  if (!data?.status) throw new Error('Could not fetch that YouTube video. Check the link and try again.');
  return {
    title: data.title,
    author: data.author,
    thumbnail: data.thumbnail,
    mp4: data.mp4,
    mp3: data.mp3,
  };
}

/** TikTok video → direct (no-watermark) video/audio links. */
export async function tiktokDownload(url) {
  const data = await getJson(`/ttdl?url=${encodeURIComponent(url)}`);
  if (!data?.status && !data?.video) throw new Error('Could not fetch that TikTok video. Check the link and try again.');
  const videos = data.video || [];
  const audios = data.audio || [];
  if (videos.length === 0) throw new Error('TikTok returned no downloadable video for that link.');
  return {
    title: data.title,
    author: data.title_audio,
    thumbnail: data.thumbnail,
    video: videos[0],
    audio: audios[0],
  };
}

/** Instagram post/reel/story → direct media links. */
export async function instagramDownload(url) {
  const data = await getJson(`/igdl?url=${encodeURIComponent(url)}`);
  const list = Array.isArray(data) ? data : (data?.data || []);
  if (!list.length) throw new Error('Could not fetch that Instagram link. It may be private or invalid.');
  return list.map(item => ({
    thumbnail: item.thumbnail,
    url: item.url,
    resolution: item.resolution,
  })).filter(i => i.url);
}

/** Facebook video → direct (SD + HD) links. */
export async function facebookDownload(url) {
  const data = await getJson(`/fbdown?url=${encodeURIComponent(url)}`);
  if (!data?.status || (!data.Normal_video && !data.HD)) throw new Error('Could not fetch that Facebook video. Check the link and try again.');
  return {
    sd: data.Normal_video,
    hd: data.HD || data.Hd_video,
  };
}

/** Twitter/X post → direct video/media links. */
export async function twitterDownload(url) {
  const data = await getJson(`/twitter?url=${encodeURIComponent(url)}`);
  const links = (data?.url || []).filter(u => u && (u.hd || u.sd || u.url));
  if (!data?.status || links.length === 0) throw new Error('Could not fetch media from that X/Twitter post. It may not contain a video, or the link is invalid.');
  const best = links[links.length - 1];
  return {
    title: data.title,
    url: best.hd || best.sd || best.url,
  };
}

/** Spotify track → direct mp3 download link. */
export async function spotifyDownload(url) {
  const data = await getJson(`/spotify?url=${encodeURIComponent(url)}`);
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
  const data = await getJson(`/pinterest?url=${encodeURIComponent(query)}`);
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

export default {
  youtubeSearch,
  youtubeDownload,
  tiktokDownload,
  instagramDownload,
  facebookDownload,
  twitterDownload,
  spotifyDownload,
  pinterestSearch,
  apkSearch,
  webSearch,
  getWeather,
  translateText,
  wikiSearch,
  getLyrics,
};
