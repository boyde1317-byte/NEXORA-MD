import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { config } from '../../../config/index.js';
import brand from '../../../config/brand.js';

export default {
  name: 'sticker',
  aliases: ['s', 'wm', 'pack'],
  category: 'media',
  description: 'Converts an image or video (current or quoted) into a WhatsApp sticker.',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    let mediaBuffer = null;

    if (m.type === 'imageMessage' || m.type === 'videoMessage') {
      await m.reply('⏳ _Downloading and converting media..._');
      mediaBuffer = await m.download();
    } else if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.type === 'videoMessage')) {
      await m.reply('⏳ _Downloading and converting quoted media..._');
      mediaBuffer = await m.quoted.download();
    }

    if (!mediaBuffer) {
      return await m.reply(
        `❌ Please send an image/video with \`${config.prefix[0]}sticker\` as the caption, or reply to an existing image/video.`
      );
    }

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

      await sock.sendMessage(m.from, { sticker: stickerBuffer }, { quoted: m });
    } catch (err) {
      console.error('[PLUGIN ERROR] sticker conversion failed:', err);
      await m.reply(`❌ Failed to create sticker: ${err.message}`);
    }
  }
};
