import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const mediaMenu = {
  id: 10,
  name: 'media',
  description: 'Rich Media Showcase with full-banner ExternalAdReply layout',
  supportedMessages: ['imageMessage', 'extendedTextMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Elegant menu caption
    const caption = `🎨 *MEDIA SHOWCASE DASHBOARD*\n\n` + buildTextMenu(menuData);

    // Retrieve selected style 10 dynamic image (static, random, rotate, url)
    const imgData = await imageManager.getMenuImage(10);

    // Context metadata containing the externalAdReply
    const contextInfo = {
      externalAdReply: {
        title: `🤖 ${menuData.botName.toUpperCase()} CORE`,
        body: `Uptime: ${menuData.uptime} | Active Plugins: ${menuData.totalCommands}`,
        sourceUrl: 'https://ai.studio/build',
        mediaType: 1, // Photo style
        renderLargerThumbnail: true, // Display full-sized card image
        showAdAttribution: true
      }
    };

    // Safely assign either buffer or URL based on mode
    if (imgData.source && (imgData.source.startsWith('http://') || imgData.source.startsWith('https://'))) {
      contextInfo.externalAdReply.thumbnailUrl = imgData.source;
    } else if (imgData.buffer) {
      contextInfo.externalAdReply.thumbnail = imgData.buffer;
    } else {
      contextInfo.externalAdReply.thumbnail = imgData.thumbnail; // fallback base64 or pixel buffer
    }

    // Send text message adorned with the external ad card
    return await sock.sendMessage(m.from, {
      text: caption,
      contextInfo: contextInfo
    }, { quoted: m });
  }
};

export default mediaMenu;
