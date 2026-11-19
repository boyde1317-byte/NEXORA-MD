/**
 * gallery.js — swipeable image gallery in one bubble.
 *
 * Usage:
 *   .gallery <url> <url> ...      → fetches each image, inlines it, sends the viewer
 *   (reply to an image) .gallery  → puts that image in the viewer
 *
 * The rendering lives in src/lib/galleryCard.js (data-URI HTML inside a
 * GenAIaeacdsnwHtmlPrimitive), so other plugins can reuse it directly.
 */
import { downloadMediaMessage } from 'baileys';
import { collectGalleryDataUris, sendGalleryCard, GALLERY_LIMITS } from '../../lib/galleryCard.js';

const URL_RE = /^https?:\/\//i;

export default {
  name: 'gallery',
  aliases: ['swipe', 'viewer'],
  category: 'media',
  description: 'Swipeable image gallery in one card. Usage: .gallery <url...> or reply to an image',
  cooldown: 5000,
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    const urls = args.filter((a) => URL_RE.test(a)).slice(0, GALLERY_LIMITS.images);
    const items = [];

    const quotedIsImage =
      m.quoted &&
      (m.quoted.mtype === 'imageMessage' ||
        m.quoted.message?.imageMessage ||
        m.quoted.mimetype?.startsWith('image/'));

    if (quotedIsImage) {
      try {
        const buffer = await downloadMediaMessage(m.quoted, 'buffer', {});
        const mime = m.quoted.mimetype || 'image/jpeg';
        items.push({ uri: `data:${mime};base64,${buffer.toString('base64')}`, size: buffer.length });
      } catch (err) {
        console.warn('[gallery] quoted image failed:', err.message);
      }
    }

    if (!urls.length && !items.length) {
      return await m.reply(
        `Usage: ${p}gallery <url> <url> ...\n` +
          `or reply to an image with ${p}gallery\n\n` +
          `Up to ${GALLERY_LIMITS.images} images, ${Math.round(GALLERY_LIMITS.bytes / 1024)} KB total.`
      );
    }

    const fetched = urls.length ? await collectGalleryDataUris(urls) : [];
    const all = [...items, ...fetched];
    if (!all.length) return await m.reply('None of those images could be fetched.');

    const sent = await sendGalleryCard(
      sock,
      m.chat,
      {
        title: `${all.length} image${all.length === 1 ? '' : 's'}`,
        hint: 'swipe with the arrows',
        items: all,
      },
      { quoted: m }
    );

    if (!sent) {
      return await m.reply(
        `The gallery could not be sent (payload over ${Math.round(GALLERY_LIMITS.bytes / 1024)} KB or the rich card was refused).`
      );
    }
    return sent;
  },
};
