import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richCodeCard } from '../../lib/interactiveKit.js';

function parseCodeReply(reply) {
  const match = reply.match(/```([a-zA-Z0-9+#.-]*)\n([\s\S]*?)```/);
  if (!match) {
    return { language: 'text', code: reply.trim(), explanation: '' };
  }
  const [full, lang, code] = match;
  const explanation = reply.replace(full, '').trim();
  return { language: lang || 'text', code: code.trim(), explanation };
}

export default {
  name: 'code',
  aliases: ['codegen', 'coder'],
  category: 'ai',
  description: 'Generate code with Nexora AI. Usage: .code <what to build>',
  cooldown: 6000,
  execute: async ({ m, sock, args, prefix }) => {
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error(
        'AI is not configured. Set GEMINI_API_KEY in .env to enable this command.'
      );
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return await m.reply.info(
        `Usage: \`${prefix}code <what to build>\`\n\nExample: \`${prefix}code a python function to reverse a linked list\``,
        'NEXORA CODE'
      );
    }

    await withReactionStatus(m, async () => {
      try {
        const reply = await aiTextGenerator.generateCode(prompt);
        const { language, code, explanation } = parseCodeReply(reply);
        await richCodeCard(sock, m.from, {
          code,
          language,
          caption: explanation ? `✦ *Nexora Code*\n\n${explanation}` : '✦ *Nexora Code*',
          footer: `Prompt: ${prompt}`.slice(0, 120),
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`I couldn't generate that code: ${err.message}`);
        throw err;
      }
    });
  }
};
