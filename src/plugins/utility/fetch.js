/**
 * fetch.js — .fetch <url> — general URL file downloader (max 200 MB).
 *
 * Ported from LUNA MD plugins/internet-fetch.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn.sendFile` /
 *     `conn.sendMessage` -> `sock.sendMessage(m.from, ...)`.
 *   - No `get` alias: NexoraFlex already ships src/plugins/utility/get.js
 *     as `.get`, so this stays `.fetch` only.
 *   - URL is taken from args (or a quoted message's text) instead of the
 *     raw message text, so a bare URL pasted after the command works and
 *     stray text around it is ignored.
 *   - Download is capped after the body arrives too, not just by the
 *     content-length header (a lying header can't blow past 200 MB).
 *   - Errors reply instead of throwing, so the dispatcher doesn't print
 *     a stack trace into the chat.
 */
import path from 'path';

const MAX_BYTES = 200 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export default {
  name: 'fetch',
  aliases: [],
  category: 'utility',
  description: 'Download a file from a URL (max 200 MB). Usage: .fetch <url>',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    let text = args.join(' ').trim() || m.quoted?.text || '';
    if (!/^https?:\/\//i.test(text)) text = text.match(/https?:\/\/\S+/i)?.[0] || '';
    if (!text) return await m.reply.error('Usage: `.fetch <url>` — give me a link to download.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let res;
    try {
      res = await fetch(text, { redirect: 'follow', headers: { 'user-agent': UA }, signal: controller.signal });
    } catch (e) {
      clearTimeout(timeout);
      return await m.reply.error(`Failed to fetch URL: ${e.message}`);
    }
    clearTimeout(timeout);

    if (!res.ok) return await m.reply.error(`HTTP Error ${res.status}`);

    const type = (res.headers.get('content-type') || '').split(';')[0];
    const size = Number(res.headers.get('content-length') || 0);
    if (size > MAX_BYTES) return await m.reply.error('File too large (200 MB max).');

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_BYTES) return await m.reply.error('File too large (200 MB max).');

    const finalUrl = res.url || text;
    let filename = 'file';
    try { filename = path.basename(new URL(finalUrl).pathname) || 'file'; } catch (_) {}
    if (!filename || filename === '/' || filename === '.') filename = 'file';

    if (type.startsWith('image/')) {
      return await sock.sendMessage(m.from, { image: buffer, caption: text }, { quoted: m });
    }

    if (type === 'application/json') {
      try {
        const pretty = JSON.stringify(JSON.parse(buffer.toString()), null, 2);
        await m.reply(pretty.slice(0, 65536));
        return await sock.sendMessage(m.from, {
          document: Buffer.from(pretty),
          fileName: 'file.json',
          mimetype: 'application/json',
        }, { quoted: m });
      } catch (_) {
        return await m.reply.error('Broken JSON.');
      }
    }

    if (type.startsWith('text/')) {
      const txt = buffer.toString('utf8');
      await m.reply(txt.slice(0, 65536));
      return await sock.sendMessage(m.from, {
        document: Buffer.from(txt),
        fileName: type === 'text/html' ? 'file.html' : 'file.txt',
        mimetype: type || 'text/plain',
      }, { quoted: m });
    }

    return await sock.sendMessage(m.from, {
      document: buffer,
      fileName: filename,
      mimetype: type || 'application/octet-stream',
      caption: text,
    }, { quoted: m });
  },
};
