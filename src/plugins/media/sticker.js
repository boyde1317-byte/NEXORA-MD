import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { config } from '../../../config/index.js';
import brand from '../../../config/brand.js';
import { DownloadProgress } from '../../lib/progress.js';

export default {
  name: 'sticker',
  aliases: ['s', 'wm', 'pack'],
  category: 'media',
  description: 'Converts an image or video (current or quoted) into a WhatsApp sticker.',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    let mediaBuffer = null;

    if (m.type === 'imageMessage' || m.type === 'videoMessage') {
      mediaBuffer = await m.download();
    } else if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.type === 'videoMessage')) {
      mediaBuffer = await m.quoted.download();
    }

    if (!mediaBuffer) {
      return await m.reply(
        `❌ Please send an image/video with \`${config.prefix[0]}sticker\` as the caption, or reply to an existing image/video.`
      );
    }

    const progress = new DownloadProgress(sock, m.from, m, { intervalMs: 3000 });
    await progress.start('Converting sticker');

    try {
      const packName   = args.join(' ') || brand.name;
      const authorName = brand.creator;

      const sticker = new Sticker(mediaBuffer, {
        pack:    packName,
        author:  authorName,
        type:    StickerTypes.FULL,
        quality: 60
      });

      const stickerBuffer = await sticker.toBuffer();
      await progress.done('');

      await sock.sendMessage(m.from, { sticker: stickerBuffer }, { quoted: m });
    } catch (err) {
      console.error('[PLUGIN ERROR] sticker conversion failed:', err);
      await progress.fail(`Failed to create sticker: ${err.message}`);
    }
  }
};
