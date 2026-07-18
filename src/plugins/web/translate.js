import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'translate',
  aliases: ['tr'],
  category: 'web',
  description: 'Translate text to a specified language.',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    let targetLang = 'en';
    let text = args.join(' ');

    if (m.quoted) {
      if (args[0]) {
        targetLang = args[0];
      }
      text = m.quoted.text;
    } else if (args.length > 1) {
      targetLang = args[0];
      text = args.slice(1).join(' ');
    }

    if (!text) {
      return await m.reply.info('Usage: `!tr <lang> <text>` or reply to a message with `!tr <lang>`', 'TRANSLATOR');
    }
    
    try {
      const translated = await Providers.translate(text, targetLang);
      
      await copyResultCard(sock, m.from, {
        text: `🌐 *TRANSLATION (${targetLang})*\n\n${translated}`,
        footer: 'Powered by Google Translate API',
        copyLabel: '📋 Copy Translation',
        copyValue: translated
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Translation failed: ${err.message}`);
    }
  }
};
