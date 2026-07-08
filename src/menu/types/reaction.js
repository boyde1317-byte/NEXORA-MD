import { buildCompactMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const reactionMenu = {
  id: 11,
  name: 'reaction',
  description: 'Ultra-lightweight reaction-triggered and live-edited inline menu',
  supportedMessages: ['react', 'edit'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(11);

    // 1. React to the incoming user message with a loading state emoji
    try {
      await m.react('⏳');
    } catch (e) {}

    // 2. Send a temporary loading banner in the thread
    const loadingMsg = await sock.sendMessage(m.from, {
      text: `🤖 *${menuData.botName.toUpperCase()} CONSOLE*\n\n⏳ _Synchronizing plugins and command directories..._`
    }, { quoted: m });

    // 3. Wait a brief moment to simulate processing and let the UI breath
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 4. Update the trigger reaction to complete state
    try {
      await m.react('✅');
    } catch (e) {}

    // 5. Compile the beautiful compact list and live-edit the sent message
    const finalMenuText = buildCompactMenu(menuData);
    
    return await sock.sendMessage(m.from, {
      text: finalMenuText,
      edit: loadingMsg.key
    });
  }
};

export default reactionMenu;
