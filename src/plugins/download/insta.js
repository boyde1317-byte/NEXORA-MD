/**
 * insta.js — .insta — Instagram downloader via the insget.net web
 * service (cookie jar + CSRF, fetch the media list, download the best
 * quality, up to 5 items).
 *
 * Ported from the insget.net plugin moonson pasted in chat
 * (staged source: nexora-bulk-port/source-insget-insta.js).
 *
 * Name: `insta` with NO `ig`/`instagram` aliases — NexoraFlex already
 * owns `.ig` / `.instagram` / `.igdl` (src/plugins/download/ig.js).
 *
 * Differences from the pasted source:
 *   - No axios (NexoraFlex has none): global `fetch` throughout. The
 *     cookie jar now reads `Set-Cookie` via `getSetCookie()` (with a
 *     plain `get('set-cookie')` fallback). Everything else about the
 *     flow is the same: GET /nl for the CSRF token, POST /fetch (XHR),
 *     parse the `media-download-*` forms, POST /media-download for the
 *     binary.
 *   - English only: the usage box, "download successful" captions and
 *     all error strings were Indonesian in the paste; `Accept-Language:
 *     id-ID` is now `en-US,en`.
 *   - `conn.sendMessage(m.chat, ...)` -> `sock.sendMessage(m.from, ...)`
 *     and `conn.sendMessage` reacts -> `m.react` (house pattern).
 *   - `handler.help` listed a second `ig <link>` line that would have
 *     collided with the house `.ig` — removed with the aliases.
 */
const BASE = 'https://insget.net';
const UA = 'Mozilla/5.0 (Linux; Android 15; RMX3930 Build/AP3A.240905.015.A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36';
const MAX_ITEMS = 5;
const IG_REGEX = /^https?:\/\/(www\.)?instagram\.com\/\S+/i;

function createJar() {
  const jar = { locale: 'en' };
  return {
    update(headers) {
      const cookies =
        (typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : null) ||
        (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
      for (const c of cookies) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header: () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
    get: (k) => jar[k],
  };
}

async function call(jar, method, path, { form, xhr = false, binary = false } = {}) {
  const headers = {
    'User-Agent': UA,
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: jar.header(),
    Referer: `${BASE}/nl`,
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers.Origin = BASE;
    const xsrf = jar.get('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    if (xhr) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers.Accept = 'application/json, text/javascript, */*; q=0.01';
    } else {
      headers.Accept = 'text/html,application/xhtml+xml,*/*;q=0.8';
    }
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(60000),
  });
  jar.update(res.headers);
  const data = binary ? await res.arrayBuffer() : await res.text();
  return { status: res.status, headers: res.headers, data };
}

function parseItems(html) {
  const items = [];
  const forms = html.split(/<form[^>]+name="media-download-/).slice(1);
  for (const f of forms) {
    const token = /name="_token"\s+value="([^"]*)"/.exec(f)?.[1];
    const username = /name="username"\s+value="([^"]*)"/.exec(f)?.[1] || '';
    const opts = [...f.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g)]
      .map((x) => ({ value: x[1], label: x[2].trim() }));
    if (token && opts.length) items.push({ token, username, opts });
  }
  return items;
}

function pickBest(opts) {
  const num = (o) => parseInt((o.label.match(/\d+/) || [0])[0], 10);
  const byNum = [...opts].sort((a, b) => num(b) - num(a))[0];
  if (num(byNum) > 0) return byNum;
  return opts.find((o) => /hq|hd/i.test(o.label)) || opts[0];
}

export default {
  name: 'insta',
  aliases: [],
  category: 'download',
  description: 'Download Instagram media from a link (via insget.net). Usage: .insta <link>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const cmd = commandName || 'insta';
    const url = ((args || [])[0] || '').trim();
    if (!IG_REGEX.test(url)) {
      return m.reply(
        `📌 *How to use:*\nType: \`${prefix}${cmd} <instagram link>\`\nExample: \`${prefix}${cmd} https://www.instagram.com/reel/xxx\``
      );
    }
    try { await m.react('⏳'); } catch (_) {}
    try {
      const jar = createJar();
      const page = await call(jar, 'GET', '/nl');
      if (page.status >= 400) throw new Error(`The site returned ${page.status} (possibly Cloudflare)`);
      const csrf =
        /name="csrf-token"\s+content="([^"]+)"/.exec(page.data)?.[1] ||
        /name="_token"\s+value="([^"]+)"/.exec(page.data)?.[1];
      const form = { url };
      if (csrf) form._token = csrf;
      const r = await call(jar, 'POST', '/fetch', { form, xhr: true });
      let json;
      try {
        json = JSON.parse(r.data);
      } catch (_) {
        throw new Error(`The /fetch response was not JSON (status ${r.status})`);
      }
      if (!json.status) throw new Error(json.message || 'Link not supported or account is private');
      const items = parseItems(json.data || '');
      if (!items.length) throw new Error('No media in this link');
      let sent = 0;
      let lastErr = 'Download failed';
      for (const it of items.slice(0, MAX_ITEMS)) {
        const opt = pickBest(it.opts);
        const d = await call(jar, 'POST', '/media-download', {
          binary: true,
          form: { _token: it.token, action_type: 'download', username: it.username, url: opt.value },
        });
        const type = String(d.headers.get('content-type') || '');
        if (d.status !== 200 || !/^(video|image)\//.test(type)) {
          lastErr = `media-download returned ${d.status} (${type || 'no type'})`;
          continue;
        }
        const buf = Buffer.from(d.data);
        if (type.startsWith('video/')) {
          await sock.sendMessage(m.from, { video: buf, mimetype: 'video/mp4', caption: '✅ Downloaded successfully' }, { quoted: m });
        } else {
          await sock.sendMessage(m.from, { image: buf, caption: '✅ Downloaded successfully' }, { quoted: m });
        }
        sent++;
      }
      if (!sent) throw new Error(lastErr);
      try { await m.react('✅'); } catch (_) {}
    } catch (err) {
      try { await m.react('❌'); } catch (_) {}
      await m.reply(`❌ *Error:* ${err.message}`);
    }
  },
};
