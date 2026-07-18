/**
 * ai.js — Nexora AI chat powered by Google Gemini.
 *
 * Upgraded: adds mixedCard with follow-up action buttons after the AI reply
 * so users can immediately pivot to brainstorm, code review, vision, etc.
 */
import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'ai',
  aliases: ['gpt', 'ask', 'chat'],
  category: 'ai',
  description: 'Chat with Nexora AI. Usage: .ai <message>',
  cooldown: 5000,
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
        `Usage: \`${p}ai <message>\`\n\nExample: \`${p}ai explain how photosynthesis works\``,
        'NEXORA AI'
      );
    }

    await withReactionStatus(m, async () => {
      const reply = await aiTextGenerator.generateText(prompt);

      // Send the AI response as a plain reply (preserves the full text without truncation)
      await m.reply(reply);

      // ── Follow-up interactive card ──────────────────────────────────────
      // Non-critical: never let a failed card surface as an error.
      try {
        // Truncate prompt for use as a pre-filled command arg (WA button ID limit)
        const shortPrompt = prompt.length > 80 ? prompt.slice(0, 77) + '…' : prompt;

        await mixedCard(sock, m.from, {
          text:   '🤖 *What would you like to do next?*',
          footer: 'NEXORA Intelligence • Powered by Gemini',
        }, [
          { kind: 'action', label: '🔁 Ask Again',          cmd: `${p}ai ${shortPrompt}` },
          { kind: 'action', label: '🧠 Brainstorm Ideas',   cmd: `${p}brainstorm ${shortPrompt}` },
          { kind: 'action', label: '💻 Review Code',        cmd: `${p}code ` },
          { kind: 'action', label: '✍️  Proofread Text',    cmd: `${p}proofread ` },
          { kind: 'copy',   label: '📋 Copy My Prompt',     value: prompt },
        ], { quoted: m });
      } catch (_) { /* follow-up is non-critical */ }
    });
  }
};
