/**
 * brat.js — .brat — turn text into a "brat" style sticker.
 *
 * Ported from LUNA MD plugins/sticker-brat.js.
 *
 * Differences from the original:
 *   - The original called `conn.sendSticker(m.chat, url, m)` (a Baileys
 *     helper that downloads + converts). NexoraFlex has no sendSticker on
 *     the socket, so this fetches the image itself and converts it with
 *     the house `wa-sticker-formatter` package (the same one the house
 *     sticker plugin uses), then sends it with `sock.sendMessage`.
 *   - `m.chat` -> `m.from`; usage error is a reply instead of a throw.
 *   - The image still comes from the third-party generator
 *     shinana-brat.hf.space — no key, no account, just a GET with the
 *     text in the query. If that service is down, the command errors.
 */
import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export default {
  name: 'brat',
  aliases: [],
  category: 'media',
  description: 'Turn text into a brat-style sticker. Usage: .brat your text',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const text = (args || []).join(' ').trim();
    if (!text) return m.reply('Enter text\n\nExample:\n.brat hello world');

    try {
      const url = 'https://shinana-brat.hf.space/?text=' + encodeURIComponent(text);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`generator returned ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty image from generator');

      const sticker = new Sticker(buf, {
        pack: 'NEXORA MD',
        author: 'NEXORA MD',
        type: StickerTypes.FULL,
        quality: 70,
      });
      const stickerBuffer = await sticker.toBuffer();
      await sock.sendMessage(m.from, { sticker: stickerBuffer }, { quoted: m });
    } catch (e) {
      console.error('[brat]', e);
      return m.reply('Brat error — the sticker generator did not answer. Try again in a bit.');
    }
  },
};
