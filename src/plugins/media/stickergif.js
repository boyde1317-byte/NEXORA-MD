/**
 * stickergif.js — image/video to sticker, GIF-friendly (LUNA sticker port).
 *
 *   .stickergif [pack name, author]   send/reply to media to sticker it
 *
 * Ported from the LUNA MD sticker-stickers.js plugin. NexoraFlex already
 * ships .sticker (src/plugins/media/sticker.js, aliases s/wm/pack), so
 * this variant is .stickergif and never shadows it. (The LUNA command
 * regex also matched `s` / `sticker` / `stickergif`; only `stickergif`
 * is taken here.)
 *
 * Differences from the LUNA MD original (luna-md/plugins/sticker-stickers.js):
 *   - `conn.sendSticker` does not exist in NexoraFlex: stickers are
 *     built with wa-sticker-formatter, the same way the house sticker.js
 *     does (Sticker with pack/author, FULL type).
 *   - Media comes from `m.download()` / `m.quoted.download()` and the
 *     type from `m.type` / `m.quoted.type` (the house serializer shape),
 *     not from `(q.msg || q).mimetype`.
 *   - The 10-second video cap is kept; the duration is read
 *     best-effort from the quoted message seconds field.
 *   - Pack/author text still splits on `,` `|` `-` `+` `&` as in the
 *     original; defaults are the NEXORA brand name/creator.
 *   - `m.chat` -> `m.from`; English replies kept as-is.
 */
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import brand from '../../../config/brand.js';

export default {
  name: 'stickergif',
  aliases: [],
  category: 'media',
  description: 'Turn an image or short video (under 10s) into a sticker. Usage: .stickergif [pack, author].',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    const text = args.join(' ');
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || '';
    const type = q.type || (m.quoted ? m.quoted.type : m.type) || '';

    const isMedia = /image|video|webp/.test(mime) || type === 'imageMessage' || type === 'videoMessage' || type === 'stickerMessage';
    if (!isMedia) {
      return m.reply('Send or reply to media to turn it into a sticker.');
    }

    const seconds = q.msg?.seconds || q.seconds || 0;
    if (seconds > 10) {
      return m.reply('Video must be under 10 seconds long.');
    }

    let media;
    try {
      media = await q.download();
    } catch (err) {
      return m.reply.error(`Could not download that media: ${err.message}`);
    }
    if (!media?.length) return m.reply('Send or reply to media to turn it into a sticker.');

    let packName = brand.name || 'NEXORA MD';
    let authorName = brand.creator || 'moonson';
    if (text) {
      const [pack, author] = text.split(/[,|\-+&]/);
      if (pack?.trim()) packName = pack.trim();
      if (author?.trim()) authorName = author.trim();
    }

    const isVideo = /video/.test(mime) || type === 'videoMessage';
    try {
      const sticker = new Sticker(media, {
        pack: packName,
        author: authorName,
        type: StickerTypes.FULL,
        quality: isVideo ? 50 : 70,
      });
      const stickerBuffer = await sticker.toBuffer();
      await sock.sendMessage(m.from, { sticker: stickerBuffer }, { quoted: m });
    } catch (err) {
      console.error('[stickergif] sticker conversion failed:', err);
      await m.reply.error(`Failed to create sticker: ${err.message}`);
    }
  },
};
