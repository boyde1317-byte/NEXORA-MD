import { baileysBridge } from '../../core/baileysBridge.js';
import { imageManager } from '../../images/imageManager.js';

export const eventMessageMenu = {
  id: 3,
  name: 'eventMessage',
  description: 'Native Event invitation card containing real-time dynamic metadata',
  supportedMessages: ['eventMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(3);

    // Send the custom Event Invitation Card
    const eventName = `🎉 ${menuData.botName.toUpperCase()} CONSOLE`;
    const eventDesc = `⚡ Active System Stats:\n• Total Commands: ${menuData.totalCommands}\n• Uptime: ${menuData.uptime}\n• Prefix: ${menuData.prefix}\n• Users Connected: ${menuData.users}`;
    
    return await baileysBridge.sendEvent(sock, m.from, {
      name: eventName,
      description: eventDesc,
      minutesAhead: 10,
      joinLink: 'https://call.whatsapp.com/video/ai-studio'
    }, { quoted: m });
  }
};

export default eventMessageMenu;
