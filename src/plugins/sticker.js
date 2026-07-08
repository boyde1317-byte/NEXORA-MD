import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { config } from '../../config/index.js';

export default {
  name: 'sticker',
  aliases: ['s', 'wm', 'pack'],
  category: 'media',
  description: 'Converts an image or video from your message (or a quoted message) into a WhatsApp sticker.',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    let mediaBuffer = null;

    // Check if the current message contains an image or video
    if (m.type === 'imageMessage' || m.type === 'videoMessage') {
      await m.reply('⏳ _Downloading and converting image..._');
      mediaBuffer = await m.download();
    } 
    // Check if the user replied to an image or video message
    else if (m.quoted && (m.quoted.type === 'imageMessage' || m.quoted.type === 'videoMessage')) {
      await m.reply('⏳ _Downloading and converting quoted media..._');
      mediaBuffer = await m.quoted.download();
    }

    if (!mediaBuffer) {
      return await m.reply('❌ Please send an image/video with the caption `!sticker`, or reply to an existing image/video.');
    }

    try {
      const packName = args.join(' ') || config.botName;
      const authorName = 'AI Studio Bot';

      const sticker = new Sticker(mediaBuffer, {
        pack: packName,
        author: authorName,
        type: StickerTypes.FULL,
        quality: 60
      });

      const stickerBuffer = await sticker.toBuffer();
      
      await sock.sendMessage(m.from, {
        sticker: stickerBuffer
      }, { quoted: m });
    } catch (err) {
      console.error('Sticker conversion failed:', err);
      await m.reply(`❌ Failed to create sticker: ${err.message}`);
    }
  }
};
