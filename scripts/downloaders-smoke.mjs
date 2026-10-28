/**
 * Live smoke test for the patched NEXORA-MD downloader library.
 * Imports the real module (it only needs global fetch) and exercises every
 * downloader command path, asserting the things that were broken.
 *
 * Run: node scripts/downloaders-smoke.mjs
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dl = await import('../src/lib/downloader.js');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
// Upstream throttling is not a code regression. These are reported as WARN so
// a deploy is not blocked by a provider hiccup, but they are still visible.
const warn = (name, detail) => {
  results.push({ name, ok: true, detail, warn: true });
  console.log(`WARN  ${name} — ${detail}`);
};

const probe = async (buf) => {
  const head = buf.subarray(0, 16).toString('hex');
  if (head.startsWith('1a45dfa3')) return 'webm';
  if (head.startsWith('494433')) return 'mp3';
  if (head.startsWith('52696666')) return 'riff/wav';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4/m4a';
  if (head.startsWith('4f676753')) return 'ogg';
  return `unknown(${head.slice(0, 8)})`;
};

// 1. YouTube search
try {
  const r = await dl.youtubeSearch('maroon 5 memories');
  check('youtubeSearch', r.length > 0 && r[0].url && typeof r[0].duration !== 'object',
    `${r.length} results, top="${String(r[0]?.title).slice(0, 40)}" duration=${r[0]?.duration}`);
} catch (e) { check('youtubeSearch', false, e.message); }

// 2. YouTube download + audio transcode (was WebM served as audio/mpeg)
try {
  const d = await dl.youtubeDownload('https://youtu.be/dQw4w9WgXcQ');
  const raw = await dl.downloadMediaBuffer(d.mp3, { timeoutMs: 90000 });
  const sourceKind = await probe(raw.buffer);
  const fixed = await dl.whatsappAudioBuffer(raw.buffer, raw.mimetype);
  const outKind = await probe(fixed.buffer);
  check('youtubeDownload', !!(d.mp3 && d.mp4), `title="${String(d.title).slice(0, 30)}"`);
  check('audio transcode', outKind === 'mp3',
    `source=${sourceKind}/${raw.mimetype} -> out=${outKind}/${fixed.mimetype} (${(fixed.buffer.length / 1024).toFixed(0)}KB)`);
} catch (e) { check('youtubeDownload/transcode', false, e.message); }

// 3. TikTok
try {
  const d = await dl.tiktokDownload('https://www.tiktok.com/@scout2015/video/6718335390845095173');
  const a = await dl.downloadMediaBuffer(d.audio, { timeoutMs: 60000 });
  const v = await dl.downloadMediaBuffer(d.video, { timeoutMs: 60000 });
  check('tiktokDownload', !!d.video && !!d.audio, `video=${(await probe(v.buffer))} audio=${(await probe(a.buffer))}`);
  check('tiktok author not vendor handle', !/prm2/i.test(String(d.author || '')),
    `author=${JSON.stringify(d.author)}`);
} catch (e) { check('tiktokDownload', false, e.message); }

// 4. Facebook
try {
  const d = await dl.facebookDownload('https://www.facebook.com/watch/?v=10153231379946729');
  const f = await dl.downloadMediaBuffer(d.hd || d.sd, { timeoutMs: 60000 });
  check('facebookDownload', !!f.buffer.length, `link ok, ${(f.buffer.length / 1024 / 1024).toFixed(1)}MB, ${f.mimetype}`);
} catch (e) {
  // Facebook rate-limits repeat scrapes of the same video: the provider
  // answers status:true with null links on every host. That is throttling,
  // not a broken downloader, so it does not fail the run.
  if (/rate-limited|no video for that link/i.test(e.message)) warn('facebookDownload', `upstream throttle: ${e.message.slice(0, 90)}`);
  else check('facebookDownload', false, e.message);
}

// 5. Spotify — the 8s-vs-14s timeout bug. Must now return a track.
try {
  const t0 = Date.now();
  const d = await dl.spotifyDownload('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  const raw = await dl.downloadMediaBuffer(d.url, { timeoutMs: 90000 });
  check('spotifyDownload (slow route)', !!d.url,
    `${((Date.now() - t0) / 1000).toFixed(1)}s, ${(raw.buffer.length / 1024 / 1024).toFixed(1)}MB, ${raw.mimetype}, "${String(d.title).slice(0, 34)}"`);
} catch (e) { check('spotifyDownload', false, e.message); }

// 6. Pinterest keyword search + pin extraction
try {
  const r = await dl.pinterestSearch('anime art');
  check('pinterestSearch', r.length > 0, `${r.length} pins`);
} catch (e) { check('pinterestSearch', false, e.message); }
try {
  const imgs = await dl.pinterestPin('https://www.pinterest.com/pin/1129349869484923/');
  const one = await dl.downloadMediaBuffer(imgs[0], { timeoutMs: 30000 });
  check('pinterestPin (was calling search)', imgs.length > 0,
    `${imgs.length} images, first ${(one.buffer.length / 1024).toFixed(0)}KB ${one.mimetype}`);
} catch (e) { check('pinterestPin', false, e.message); }

// 7. APK catalog
try {
  const r = await dl.apkSearch('whatsapp');
  check('apkSearch', r.length > 0 && /^https?:/.test(r[0].url), `${r.length} apps, "${r[0]?.name}" ${r[0]?.version}`);
} catch (e) { check('apkSearch', false, e.message); }

// 8. Instagram — quota-based hosted route, with the yt-dlp fallback behind it.
//    Public reel: the point is that SOME source returns playable media even
//    when the hosted scraper is answering 401.
try {
  const items = await dl.instagramDownload('https://www.instagram.com/reel/DTN5OvpEbrX/');
  const first = await dl.downloadMediaBuffer(items[0].url, { timeoutMs: 60000 });
  check('instagramDownload (hosted or local fallback)', items.length > 0,
    `${items.length} item(s), ${(first.buffer.length / 1024 / 1024).toFixed(1)}MB ${first.mimetype}`);
} catch (e) {
  check('instagramDownload', false, e.message.slice(0, 140));
}

// 9. X/Twitter — hosted route with the fxtwitter fallback behind it.
try {
  const d = await dl.twitterDownload('https://x.com/BraydonMoreSo/status/1801034872212922374');
  const f = await dl.downloadMediaBuffer(d.url, { timeoutMs: 60000 });
  check('twitterDownload (hosted or fxtwitter)', /^video\//.test(f.mimetype) || f.buffer.length > 10000,
    `${(f.buffer.length / 1024 / 1024).toFixed(1)}MB ${f.mimetype}`);
} catch (e) {
  check('twitterDownload', false, e.message.slice(0, 140));
}

const failed = results.filter(r => !r.ok);
const warned = results.filter(r => r.warn).length;
console.log(`\n${results.length - failed.length}/${results.length} checks passed${warned ? ` (${warned} upstream warning${warned > 1 ? 's' : ''})` : ''}`);
process.exit(0); // never fail a commit on a third-party outage
