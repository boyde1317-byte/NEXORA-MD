import fs from 'node:fs';
import path from 'node:path';
import { mediaConfig } from '../../media/mediaConfig.js';
import { mediaManager } from '../../media/mediaManager.js';

export default {
  name: 'setmenumedia',
  aliases: ['media'],
  category: 'owner',
  description: 'Ingest or update background media files (audio, image, thumbnail) for the menu system.',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const type = args[0] ? args[0].toLowerCase() : null;

    if (!type || !['audio', 'image', 'thumbnail'].includes(type)) {
      const currentConfig = mediaConfig.getMenuConfig();
      let msg = `🎨 *SET MENU MEDIA ✦* 🎨\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      msg += `Configure specific background menu media assets:\n\n`;
      msg += `• *Set Audio:*\n`;
      msg += `  ↳ Reply to an audio with: \`${prefix}setmenumedia audio\`\n`;
      msg += `  ↳ Or pass a local path: \`${prefix}setmenumedia audio <file_path>\`\n\n`;
      msg += `• *Set Image:*\n`;
      msg += `  ↳ Reply to an image with: \`${prefix}setmenumedia image\`\n\n`;
      msg += `• *Set Thumbnail:*\n`;
      msg += `  ↳ Reply to an image with: \`${prefix}setmenumedia thumbnail\`\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📝 *Current Loaded Files:*\n`;
      msg += `🔊 _Audio:_ \`${currentConfig.audio || 'Not Set'}\`\n`;
      msg += `🖼️ _Image:_ \`${currentConfig.image || 'Not Set'}\`\n`;
      msg += `📐 _Thumbnail:_ \`${currentConfig.thumbnail || 'Not Set'}\``;
      
      return await m.reply(msg);
    }

    // Check if path is passed directly (only applicable for audio)
    if (type === 'audio' && args[1]) {
      const localPath = args[1];
      const resolvedPath = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
      
      if (!fs.existsSync(resolvedPath)) {
        return await m.reply(`❌ File does not exist at local path: \`${localPath}\``);
      }

      mediaConfig.setMenuConfig({ audio: localPath });
      return await m.reply(`✅ *Menu audio file path updated successfully!*\n• Path: \`${localPath}\``);
    }

    // For all other operations, we require a replied message
    if (!m.quoted) {
      return await m.reply(`❌ Please reply to the corresponding media (audio for "audio", image for "image" or "thumbnail") and type \`${prefix}setmenumedia ${type}\``);
    }

    const qType = m.quoted.type;
    const msgObj = m.quoted.msg || {};
    const mimetype = msgObj.mimetype || '';

    // Validate the media type
    if (type === 'audio') {
      const isAudio = qType === 'audioMessage' || mimetype.startsWith('audio/');
      if (!isAudio) {
        return await m.reply('❌ The replied message is not an audio file.');
      }
    } else if (type === 'image' || type === 'thumbnail') {
      const isImage = qType === 'imageMessage' || mimetype.startsWith('image/');
      if (!isImage) {
        return await m.reply('❌ The replied message is not an image file.');
      }
    }

    await m.reply(`⏳ _Downloading and updating menu ${type} asset..._`);

    try {
      // Download replied attachment buffer
      const buffer = await m.quoted.download();
      if (!buffer) {
        return await m.reply('❌ Failed to download attachment buffer from WhatsApp servers.');
      }

      // Save media through mediaManager
      const savedPath = await mediaManager.saveRepliedMedia(type, buffer, mimetype);
      return await m.reply(`✅ *Menu ${type} updated successfully!*\n• Saved relative path: \`${savedPath}\``);
    } catch (err) {
      console.error(`Failed to ingest menu media (${type}):`, err);
      return await m.reply(`❌ Error writing media file: ${err.message}`);
    }
  }
};
