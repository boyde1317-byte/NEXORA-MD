import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { DownloadProgress } from '../../lib/progress.js';

export default {
  name: 'brainstorm',
  aliases: ['ideas', 'ideate'],
  category: 'ai',
  description: 'Generates creative ideas on a topic. Usage: .brainstorm <topic>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error('AI is not configured. Set GEMINI_API_KEY in .env.');
    }
    
    const topic = args.join(' ').trim();
    if (!topic) {
      return await m.reply.info(`Usage: \`${p}brainstorm <topic>\`\n\nExample: \`${p}brainstorm app ideas for college students\``, 'NEXORA AI');
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Brainstorming');
      try {
        const reply = await aiTextGenerator.brainstormIdeas(topic);
        await progress.done();

        await mixedCard(sock, m.from, {
          text: `💡 *BRAINSTORM: ${topic.toUpperCase()}*\n\n${reply}`,
          footer: 'Nexora AI Ideation',
        }, [
          { kind: 'copy',   label: '📋 Copy Ideas',      value: reply },
          { kind: 'action', label: '💡 More Ideas',      cmd: `${p}brainstorm ${topic}` },
          { kind: 'action', label: '🤖 Ask AI',         cmd: `${p}ai Tell me more about: ${topic}` },
        ], { quoted: m });
      } catch (err) {
        await progress.fail(`❌ Failed to brainstorm: ${err.message}`);
      }
    });
  }
};
