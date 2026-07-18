import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'proofread',
  aliases: ['grammar', 'fixtext'],
  category: 'ai',
  description: 'Proofreads and corrects grammar/spelling in text.',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error('AI is not configured. Set GEMINI_API_KEY in .env.');
    }
    
    let text = args.join(' ').trim();
    if (m.quoted && !text) {
      text = m.quoted.text;
    }
    
    if (!text) {
      return await m.reply.info(`Usage: \`${prefix}proofread <text>\` or reply to a message with \`${prefix}proofread\``, 'NEXORA AI');
    }

    await withReactionStatus(m, async () => {
      try {
        const reply = await aiTextGenerator.proofreadText(text);
        await copyResultCard(sock, m.from, {
          text: `✅ *PROOFREAD TEXT*\n\n${reply}`,
          footer: 'Nexora AI Proofreader',
          copyLabel: '📋 Copy Fixed Text',
          copyValue: reply
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`Failed to proofread: ${err.message}`);
        throw err;
      }
    });
  }
};
