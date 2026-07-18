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
        sourceUrl: `https://wa.me/${menuData.ownerNumber || '233597514499'}`,
        mediaType: 1, // Photo style
        renderLargerThumbnail: true, // Display full-sized card image
        showAdAttribution: true
      }
    };

    // Always prefer the downloaded buffer — using thumbnailUrl requires WhatsApp's
    // servers to re-fetch the URL which is unreliable and produces a dark blank area.
    if (imgData.buffer) {
      contextInfo.externalAdReply.thumbnail = imgData.buffer;
    } else if (imgData.source && (imgData.source.startsWith('http://') || imgData.source.startsWith('https://'))) {
      contextInfo.externalAdReply.thumbnailUrl = imgData.source;
    }
    // If neither — omit thumbnail entirely; WhatsApp shows no image (better than a black pixel)

    // Send text message adorned with the external ad card
    return await sock.sendMessage(m.from, {
      text: caption,
      contextInfo: contextInfo
    }, { quoted: menuData.audioQuote || m });
  }
};

export default mediaMenu;
