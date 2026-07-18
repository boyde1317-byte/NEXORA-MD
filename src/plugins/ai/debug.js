import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'debug',
  aliases: ['fixcode'],
  category: 'ai',
  description: 'Analyzes code for bugs and provides a fix.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error('AI is not configured. Set GEMINI_API_KEY in .env.');
    }
    
    let code = args.join(' ').trim();
    if (m.quoted && !code) {
      code = m.quoted.text;
    }
    
    if (!code) {
      return await m.reply.info(`Usage: \`${prefix}debug <code>\` or reply to a message containing code.`, 'NEXORA AI');
    }

    await withReactionStatus(m, async () => {
      try {
        const reply = await aiTextGenerator.debugCode(code);
        await copyResultCard(sock, m.from, {
          text: `🐛 *CODE DEBUGGER*\n\n${reply}`,
          footer: 'Nexora AI Developer Tools',
          copyLabel: '📋 Copy Response',
          copyValue: reply
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`Failed to debug code: ${err.message}`);
        throw err;
      }
    });
  }
};
