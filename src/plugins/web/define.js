import { Providers } from '../../lib/webClient.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'define',
  aliases: ['dict', 'dictionary'],
  category: 'web',
  description: 'Get the dictionary definition of a word.',
  cooldown: 5000,
  execute: async ({ m, sock, args }) => {
    const word = args[0];
    if (!word) return await m.reply.info('Usage: `!define <word>`', 'DICTIONARY');
    
    try {
      const data = await Providers.define(word);
      if (!data || !data.length) throw new Error("Word not found.");
      
      const entry = data[0];
      let text = `📖 *${entry.word.toUpperCase()}*\n`;
      if (entry.phonetic) text += `🗣️ _${entry.phonetic}_\n`;
      text += `\n`;
      
      entry.meanings.forEach(m => {
        text += `*${m.partOfSpeech}*\n`;
        m.definitions.slice(0, 3).forEach((d, i) => {
          text += `  ${i + 1}. ${d.definition}\n`;
          if (d.example) text += `     _Ex: "${d.example}"_\n`;
        });
        text += '\n';
      });

      await copyResultCard(sock, m.from, {
        text: text.trim(),
        footer: 'Powered by Free Dictionary API',
        copyLabel: '📋 Copy Definition',
        copyValue: text.trim()
      }, { quoted: m });
    } catch (err) {
      await m.reply.error(`Failed to define "${word}": ${err.message}`);
    }
  }
};
