import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'brainstorm',
  aliases: ['ideas', 'ideate'],
  category: 'ai',
  description: 'Generates creative ideas on a topic.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error('AI is not configured. Set GEMINI_API_KEY in .env.');
    }
    
    const topic = args.join(' ').trim();
    if (!topic) {
      return await m.reply.info(`Usage: \`${prefix}brainstorm <topic>\``, 'NEXORA AI');
    }

    await withReactionStatus(m, async () => {
      try {
        const reply = await aiTextGenerator.brainstormIdeas(topic);
        await copyResultCard(sock, m.from, {
          text: `💡 *BRAINSTORM: ${topic.toUpperCase()}*\n\n${reply}`,
          footer: 'Nexora AI Ideation',
          copyLabel: '📋 Copy Ideas',
          copyValue: reply
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`Failed to brainstorm: ${err.message}`);
        throw err;
      }
    });
  }
};
