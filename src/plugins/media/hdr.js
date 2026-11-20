/**
 * hdr.js — .hdr — upscale an image 4x via the imglarger API.
 *
 * Ported from LUNA MD plugins/tools-hd.js (commands upscale/hd/hdr).
 * Named hdr because NEXORA MD already ships .hd (src/plugins/media/hd.js,
 * ihancer API) — this is the separate LUNA imglarger variant, fixed at 4x.
 *
 * Differences from the LUNA original:
 *   - axios + form-data + baileys.delay are gone: Node 20 ships global
 *     fetch/FormData, and form-data is not a NEXORA dependency. The
 *     upload uses a native FormData + Blob; polling sleeps on a local
 *     sleep() helper.
 *   - quoted.download() / m.download() come from the NEXORA serializer
 *     (same as house hd.js); the result is sent with sock.sendMessage
 *     instead of the LUNA conn.sendFile helper.
 *   - m.chat -> m.from; usage errors are plain replies instead of throws.
 */
const UPLOAD_URL = 'https://get1.imglarger.com/api/UpscalerNew/UploadNew';
const STATUS_URL = 'https://get1.imglarger.com/api/UpscalerNew/CheckStatusNew';
const SCALE = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function upscale(buffer, scale = SCALE) {
  const form = new FormData();
  form.append('myfile', new Blob([buffer], { type: 'image/jpeg' }), `${Date.now()}.jpg`);
  form.append('scaleRadio', String(scale));

  const upload = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Origin: 'https://imgupscaler.com' },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!upload.ok) throw new Error('Failed to upload image');
  const uploadData = await upload.json();

  for (let i = 0; i < 20; i++) {
    const check = await fetch(STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: uploadData?.data?.code, scaleRadio: scale }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await check.json();
    if (result?.data?.status === 'success') return result;
    await sleep(5000);
  }
  throw new Error('Upscale timed out');
}

export default {
  name: 'hdr',
  aliases: [],
  category: 'media',
  description: 'Upscale an image 4x. Reply to a photo with .hdr, or send a photo with the caption .hdr',
  cooldown: 10000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const quoted = m.quoted ? m.quoted : m;
    const mime = quoted?.mimetype || quoted?.msg?.mimetype || '';
    const isImage = quoted?.type === 'imageMessage' || /image/.test(mime);
    if (!isImage) {
      return await m.reply(`Send/reply to a photo with the caption ${p}hdr`);
    }
    try {
      const media = await quoted.download();
      if (!media?.length) return await m.reply.error('Could not download the image — it may have expired.');
      const res = await upscale(media, SCALE);
      const url = res?.data?.downloadUrls?.[0];
      if (!url) throw new Error('Upscaler returned no download link');
      await sock.sendMessage(m.from, { image: { url }, caption: 'Here is the result — upscaled 4x.' }, { quoted: m });
    } catch (e) {
      console.error('[hdr]', e.message);
      await m.reply.error(`Upscale failed: ${e.message}`);
    }
  },
};
