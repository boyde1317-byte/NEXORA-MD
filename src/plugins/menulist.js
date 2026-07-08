import { menuManager } from '../menu/manager.js';
import { scanCapabilities } from '../core/baileysScanner.js';

export default {
  name: 'menulist',
  aliases: ['styles', 'menus'],
  category: 'general',
  description: 'Lists all available menu presentation styles and active compatibility.',
  cooldown: 2000,
  execute: async ({ sock, m, prefix }) => {
    // 1. Scan socket capabilities
    const capabilities = scanCapabilities(sock);
    
    // 2. Get registered styles
    const styles = menuManager.getRegisteredMenus();
    const activeStyle = menuManager.getActiveMenu();

    let text = `🎨 *AVAILABLE BOT MENU STYLES* 🎨\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `_Configure your preferred menu style using_ \`${prefix}setmenu <id_or_name>\`\n\n`;

    styles.forEach(style => {
      // Determine compatibility based on scanned capabilities
      let isCompatible = true;
      let missingList = [];
      
      if (style.supportedMessages) {
        style.supportedMessages.forEach(msgType => {
          // If the message type corresponds to a capability and it is false
          if (capabilities[msgType] === false) {
            isCompatible = false;
            missingList.push(msgType);
          }
        });
      }

      const isActive = activeStyle && activeStyle.id === style.id;
      const compatStatus = isCompatible ? '🟢' : '🟡';
      const activeIndicator = isActive ? '👑 *[ACTIVE]*' : '';

      text += `${compatStatus} *${style.id}. ${style.name.toUpperCase()}* ${activeIndicator}\n`;
      text += `↳ _Description:_ ${style.description}\n`;
      if (!isCompatible) {
        text += `↳ _Compatibility:_ ⚠️ Runs in Fallback Mode (Missing: ${missingList.join(', ')})\n`;
      } else {
        text += `↳ _Compatibility:_ ✅ Fully Supported\n`;
      }
      text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🟢 = Fully Native | 🟡 = Supported with Auto-Degrade Fallback`;

    await m.reply(text);
  }
};
