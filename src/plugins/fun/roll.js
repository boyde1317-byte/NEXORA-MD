import { mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'roll',
  aliases: ['dice', 'rolldice'],
  category: 'fun',
  description: 'Roll a dice. Usage: .roll [sides]',
  cooldown: 3000,
  execute: async ({ sock, m, args, prefix }) => {
    let sides = 6;
    if (args[0] && !isNaN(args[0])) {
      sides = parseInt(args[0], 10);
    }
    if (sides < 2 || sides > 1000) {
      return await m.reply.error('Sides must be between 2 and 1000.');
    }
    
    const result = Math.floor(Math.random() * sides) + 1;
    
    await mixedCard(sock, m.from, {
      text: `✦ *DICE ROLL* ✦\n\n🎲 You rolled a *${result}* (1-${sides})`,
      footer: 'Powered by NEXORA'
    }, [
      { kind: 'action', label: '🔄 Roll Again', cmd: `${prefix}roll ${sides}` }
    ], { quoted: m });
  }
};
