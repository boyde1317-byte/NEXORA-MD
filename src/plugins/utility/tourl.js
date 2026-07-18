/**
 * tourl.js — upload media (image/video/audio/sticker/document) to a public
 * host and return a direct URL.
 *
 * Supports multiple upload platforms with automatic fallback: if the
 * requested (or default, highest-priority) host fails, the next one in
 * HOST_ORDER is tried automatically before giving up. A specific host can
 * also be forced with `.tourl <host>`.
 *
 * Hosts:
 *   - catbox     → catbox.moe        (permanent hosting, JSON-free plain-text API)
 *   - litterbox  → litterbox.catbox.moe (catbox's temporary-hosting CDN, expires)
 *   - cdn        → 0x0.st            (minimalist file CDN, plain-text API)
 *   - uguu       → uguu.se           (temporary-hosting CDN, plain-text API)
 *   - tmpfiles   → tmpfiles.org      (original host, JSON API, ~60min expiry)
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const SUPPORTED = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];

const LITTERBOX_TIMES = new Set(['1h', '12h', '24h', '72h']);

// ── Per-host uploaders. Each returns { url, note }. Throw on failure. ────────
const HOSTS = {
  catbox: {
    label: 'Catbox (permanent)',
    async upload(buffer, filename, mime) {
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', new Blob([buffer], { type: mime }), filename);

      const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body:   form,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Catbox returned ${res.status}.`);
      const url = (await res.text()).trim();
      if (!url.startsWith('http')) throw new Error(`Catbox rejected the upload: ${url || 'no response'}`);
      return { url, note: 'Permanent — never expires.' };
    },
  },

  litterbox: {
    label: 'Litterbox (temporary Catbox CDN)',
    async upload(buffer, filename, mime, extra = {}) {
      const time = LITTERBOX_TIMES.has(extra.time) ? extra.time : '1h';
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('time', time);
      form.append('fileToUpload', new Blob([buffer], { type: mime }), filename);

      const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body:   form,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Litterbox returned ${res.status}.`);
      const url = (await res.text()).trim();
      if (!url.startsWith('http')) throw new Error(`Litterbox rejected the upload: ${url || 'no response'}`);
      return { url, note: `Temporary — expires in ${time}.` };
    },
  },

  cdn: {
    label: '0x0.st (CDN)',
    async upload(buffer, filename, mime) {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mime }), filename);

      const res = await fetch('https://0x0.st', {
        method: 'POST',
        body:   form,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`0x0.st returned ${res.status}.`);
      const url = (await res.text()).trim();
      if (!url.startsWith('http')) throw new Error(`0x0.st rejected the upload: ${url || 'no response'}`);
      return { url, note: 'CDN-hosted — retention varies with file size/traffic.' };
    },
  },

  uguu: {
    label: 'Uguu (temporary CDN)',
    async upload(buffer, filename, mime) {
      const form = new FormData();
      form.append('files[]', new Blob([buffer], { type: mime }), filename);

      const res = await fetch('https://uguu.se/upload?output=text', {
        method: 'POST',
        body:   form,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Uguu returned ${res.status}.`);
      const url = (await res.text()).trim().split('\n')[0];
      if (!url.startsWith('http')) throw new Error(`Uguu rejected the upload: ${url || 'no response'}`);
      return { url, note: 'Temporary — expires after ~48 hours.' };
    },
  },

  tmpfiles: {
    label: 'tmpfiles.org',
    async upload(buffer, filename, mime) {
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: mime }), filename);

      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body:   form,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`tmpfiles.org returned ${res.status}.`);
      const json = await res.json();
      const pageUrl = json?.data?.url;
      if (!pageUrl) throw new Error('tmpfiles.org: upload succeeded but no URL returned.');
      const url = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      return { url, note: 'Temporary — expires after ~60 minutes.' };
    },
  },
};

// Default try order when no host is forced: permanent/reliable first, then
// temporary CDNs, tmpfiles last (shortest-lived).
const HOST_ORDER = ['catbox', 'litterbox', 'cdn', 'uguu', 'tmpfiles'];

export default {
  name: 'tourl',
  aliases: ['geturl', 'mediaurl', 'uploadmedia', 'fileurl'],
  category: 'utility',
  description: 'Uploads any media (image, video, audio, sticker, document) to a public host and returns a direct URL.',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const target = SUPPORTED.includes(m.quoted?.type) ? m.quoted
                 : SUPPORTED.includes(m.type)         ? m
                 : null;

    const hostArg = args[0]?.toLowerCase();
    const forcedHost = hostArg && HOSTS[hostArg] ? hostArg : null;
    if (hostArg && !forcedHost) {
      return await m.reply.error(
        `Unknown host "${hostArg}".\n\nAvailable: ${Object.keys(HOSTS).join(', ')}`
      );
    }
    const litterboxTime = forcedHost === 'litterbox' ? args[1]?.toLowerCase() : undefined;

    if (!target) {
      return await m.reply.info(
        `Reply to or send any media with \`${p}tourl\` to get a direct download link.\n\n` +
        `Supported media: image, video, audio, sticker, document.\n\n` +
        `Hosts (tried in this order by default): ${HOST_ORDER.map(h => HOSTS[h].label).join(' → ')}\n` +
        `Force a specific host: \`${p}tourl <host>\` (${Object.keys(HOSTS).join(', ')})\n` +
        `Litterbox expiry: \`${p}tourl litterbox <1h|12h|24h|72h>\``,
        'MEDIA → URL'
      );
    }

    await withReactionStatus(m, async () => {
      // NOTE: `sock` (the Baileys socket) has no `downloadMediaMessage` method —
      // that's a top-level export of the `baileys` package, not a socket method.
      // serializer.js already wires a correct `.download()` helper onto both `m`
      // and `m.quoted` (using the real `downloadMediaMessage(msg, 'buffer', {})`
      // export under the hood), so reuse that instead of calling a method that
      // doesn't exist on `sock`.
      const buffer = await target.download().catch(() => null);
      if (!buffer) throw new Error('Could not download the media. Try again.');

      if (buffer.length > 15 * 1024 * 1024) {
        throw new Error('File too large. Maximum upload size is 15 MB.');
      }

      const typeMap = {
        imageMessage:    { ext: 'jpg', mime: 'image/jpeg' },
        videoMessage:    { ext: 'mp4', mime: 'video/mp4' },
        audioMessage:    { ext: 'ogg', mime: 'audio/ogg' },
        documentMessage: { ext: 'bin', mime: 'application/octet-stream' },
        stickerMessage:  { ext: 'webp', mime: 'image/webp' },
      };
      const { ext, mime } = typeMap[target.type] ?? { ext: 'bin', mime: 'application/octet-stream' };
      const filename = `nexora_${Date.now()}.${ext}`;

      const tryOrder = forcedHost ? [forcedHost] : HOST_ORDER;
      const failures = [];
      let hostKey = null;
      let uploadResult = null;

      for (const key of tryOrder) {
        try {
          uploadResult = await HOSTS[key].upload(buffer, filename, mime, { time: litterboxTime });
          hostKey = key;
          break;
        } catch (err) {
          failures.push(`${HOSTS[key].label}: ${err.message}`);
        }
      }

      if (!uploadResult) {
        throw new Error(`All upload hosts failed.\n${failures.join('\n')}`);
      }

      const lines = [
        `📁 Type   : ${target.type.replace('Message', '')}`,
        `📏 Size   : ${(buffer.length / 1024).toFixed(1)} KB`,
        `🌐 Host   : ${HOSTS[hostKey].label}`,
        `🔗 URL    : ${uploadResult.url}`,
        ``,
        `_${uploadResult.note}_`,
      ];
      if (failures.length) {
        lines.push('', `_Fell back after: ${failures.length} host(s) failed._`);
      }

      const output = asciiBuilder.box('🔗 MEDIA UPLOADED', lines);
      await m.reply(output);
    });
  }
};
