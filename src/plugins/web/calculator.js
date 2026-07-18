import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'calculator',
  aliases: ['calc', 'math'],
  category: 'web',
  description: 'Evaluates a math expression.',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const expr = args.join(' ');
    if (!expr) return await m.reply.info('Usage: `!calc <expression>`\nExample: `!calc (12 + 8) * 3`', 'CALCULATOR');
    
    try {
      const result = await Providers.calculator(expr);
      
      await copyResultCard(sock, m.from, {
        text: `🧮 *CALCULATOR*\n\n*Expression:*\n${expr}\n\n*Result:*\n*${result}*`,
        footer: 'mathjs API',
        copyLabel: '📋 Copy Result',
        copyValue: String(result).trim()
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to calculate: ${err.message}`);
    }
  }
};
