import { mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'flip',
  aliases: ['coinflip', 'coin'],
  category: 'fun',
  description: 'Flip a coin. Usage: .flip',
  cooldown: 3000,
  execute: async ({ sock, m, prefix }) => {
    const outcome = Math.random() < 0.5 ? 'Heads' : 'Tails';
    
    await mixedCard(sock, m.from, {
      text: `✦ *COIN FLIP* ✦\n\n🪙 The coin landed on: *${outcome}*`,
      footer: 'Powered by NEXORA'
    }, [
      { kind: 'action', label: '🔄 Flip Again', cmd: `${prefix}flip` }
    ], { quoted: m });
  }
};
