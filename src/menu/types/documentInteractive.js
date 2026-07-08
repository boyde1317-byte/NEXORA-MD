import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';

export const documentInteractiveMenu = {
  id: 1,
  name: 'documentInteractive',
  description: 'Interactive Message with Document Header card',
  supportedMessages: ['interactiveMessage', 'documentMessage'],
  
  renderer: async ({ sock, m, menuData }) => {
    // Dynamically retrieve menu image metadata to support selectors & Modes
    const imgData = await imageManager.getMenuImage(1);

    // 1. Compile menu text body
    const bodyText = `📂 *DOCUMENT INTERACTIVE MENU*\n\n` + 
                     `Welcome to the Interactive Console!\n` +
                     `Use the quick buttons below to interact.`;
                     
    const footerText = `${menuData.botName} • Uptime: ${menuData.uptime}`;
    
    // 2. Generate a neat virtual document buffer for the card header
    const virtualDoc = Buffer.from(`\n📝 === ${menuData.botName.toUpperCase()} CONSOLE ===\n\nActive Prefix: ${menuData.prefix}\nTotal Commands: ${menuData.totalCommands}\nUptime: ${menuData.uptime}\nOwner: ${menuData.ownerName}\n\n===================================`);
    
    // 3. Build a document message payload to embed in the interactive header
    const documentMessage = {
      document: virtualDoc,
      mimetype: 'application/pdf',
      fileName: 'Active_Console_Menu.pdf',
      title: 'Console Menu'
    };

    // 4. Buttons parameters for Native Flow inside Interactive Message
    const buttons = [
      {
        name: 'quick_reply',
        params: {
          display_text: '💬 Category Menu',
          id: '.menulist'
        }
      },
      {
        name: 'quick_reply',
        params: {
          display_text: '⚡ System Info',
          id: '.menu aiDynamic'
        }
      }
    ];

    // Build the structural interactiveMessage with document header
    const msgContent = {
      interactiveMessage: {
        body: { text: buildTextMenu(menuData) },
        footer: { text: footerText },
        header: {
          title: '📜 Bot Interactive Menu',
          hasMediaAttachment: true,
          documentMessage: {
            url: '', // Will be uploaded locally if needed, or sent inline since it's small
            mimetype: 'application/pdf',
            title: 'Bot_Menu.pdf',
            fileLength: String(virtualDoc.length),
            fileName: 'Bot_Menu.pdf',
            contextInfo: {}
          }
        },
        nativeFlowMessage: {
          buttons: buttons.map(btn => ({
            name: btn.name,
            buttonParamsJson: JSON.stringify(btn.params)
          }))
        }
      }
    };

    // Send using the bridge relay helper
    return await baileysBridge.relayMessage(sock, m.from, { 
      viewOnceMessage: { message: msgContent } 
    }, { quoted: m });
  }
};

export default documentInteractiveMenu;
