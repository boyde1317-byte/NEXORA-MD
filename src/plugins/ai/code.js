import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { richCodeCard, mixedCard } from '../../lib/interactiveKit.js';
import { DownloadProgress } from '../../lib/progress.js';

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
    const p = prefix || '.';
    if (!aiTextGenerator.isEnabled()) {
      return await m.reply.error(
        'AI is not configured. Set GEMINI_API_KEY in .env to enable this command.'
      );
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      return await m.reply.info(
        `Usage: \`${p}code <what to build>\`\n\nExample: \`${p}code a python function to reverse a linked list\``,
        'NEXORA CODE'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Generating code');
      try {
        const reply = await aiTextGenerator.generateCode(prompt);
        await progress.done();
        const { language, code, explanation } = parseCodeReply(reply);

        await richCodeCard(sock, m.from, {
          code,
          language,
          caption: explanation ? `✦ *Nexora Code*\n\n${explanation}` : '✦ *Nexora Code*',
          footer: `Prompt: ${prompt}`.slice(0, 120),
        }, { quoted: m });

        // Follow-up card with copy + debug buttons
        try {
          await mixedCard(sock, m.from, {
            text: '✅ *Code generated!*\n\nWhat would you like to do next?',
            footer: 'NEXORA Code • Powered by Gemini',
          }, [
            { kind: 'copy',   label: '📋 Copy Code',        value: code },
            { kind: 'action', label: '🐛 Debug This Code',  cmd: `${p}debug ${code.slice(0, 100)}` },
            { kind: 'action', label: '✏️ Generate Another',  cmd: `${p}code` },
          ], { quoted: m });
        } catch (_) {}
      } catch (err) {
        await progress.fail(`❌ I couldn't generate that code: ${err.message}`);
      }
    });
  }
};
