import { menuManager } from '../menu/manager.js';
import { imageManager } from '../images/imageManager.js';

export default {
  name: 'setmenuimage',
  aliases: ['setimage', 'setimg'],
  category: 'owner',
  description: 'Saves the replied image as background/banner for the currently active menu style.',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, prefix }) => {
    if (!m.quoted) {
      const activeStyle = menuManager.getActiveMenu();
      return await m.reply(`❌ *Error:* Please reply to an image with \`${prefix}setmenuimage\` to save it for the active menu style (*Style ${activeStyle.id}: ${activeStyle.name}*).`);
    }

    const qType = m.quoted.type;
    const msgObj = m.quoted.msg || {};
    const mimetype = msgObj.mimetype || '';

    const isImage = qType === 'imageMessage' || mimetype.startsWith('image/');
    if (!isImage) {
      return await m.reply('❌ The replied message is not an image file.');
    }

    const activeStyle = menuManager.getActiveMenu();
    const styleId = activeStyle.id;

    await m.reply(`⏳ _Downloading and registering image for Style ${styleId} (${activeStyle.name})..._`);

    try {
      const buffer = await m.quoted.download();
      if (!buffer) {
        return await m.reply('❌ Failed to download replied image buffer from WhatsApp.');
      }

      const relativePath = await imageManager.saveRepliedImage(styleId, buffer, mimetype);

      return await m.reply(`✅ *Success!* Saved image to active style *${activeStyle.name}* (ID: ${styleId}).\n📁 Path: \`${relativePath}\``);
    } catch (err) {
      console.error('Failed to save menu style image:', err);
      return await m.reply(`❌ Error saving image asset: ${err.message}`);
    }
  }
};
