/**
 * aiformat.js — owner audit for the AI rich-format layer.
 *
 * Shows exactly what the model is told to produce, and proves the device can
 * paint it. `test` sends canned AI-shaped replies through the real path
 * (buildAIMarkdownMessage → AIRich → richResponseMessage) so a rendering
 * regression shows up without spending an API call or guessing a prompt.
 *
 * Usage:
 *   .aiformat                 → contract summary + current rich state
 *   .aiformat <prompt>        → which rich shape that prompt maps to
 *   .aiformat test            → send comparison / code / math samples
 *   .aiformat table           → send only the product-comparison sample
 */
import { capabilities } from '../../core/capabilities.js';
import { RICH_FORMAT_CONTRACT, detectRichIntent } from '../../lib/aiRichFormat.js';
import { sendAIRichReply } from '../../lib/aiRichReply.js';

const SAMPLES = {
  table: {
    label: 'Product comparison',
    markdown: `*iPhone 15 vs Galaxy S24*

| Feature | iPhone 15 | Galaxy S24 |
|---|---|---|
| Display | 6.1" OLED | 6.2" AMOLED |
| Chip | A16 Bionic | Exynos 2400 |
| Battery | 3,349mAh | 4,000mAh |
| Price | $799 | $799 |

*Verdict:* iPhone 15 — longer software support.`,
  },
  code: {
    label: 'Code answer',
    markdown: `*Reverse a linked list*

\`\`\`python
def reverse(head):
    prev = None
    while head:
        head.next, prev, head = prev, head, head.next
    return prev
\`\`\`

O(n) time, O(1) space.`,
  },
  math: {
    label: 'Math answer',
    markdown: 'The roots are $x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}$. When $b^2-4ac < 0$ there are no real roots.',
  },
};

export default {
  name: 'aiformat',
  aliases: ['airich', 'aiformattest'],
  category: 'owner',
  description: '🧪 AI rich-format audit — how AI replies become tables/code cards.',
  permissions: { owner: true },
  cooldown: 5000,

  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const jid = m.from || m.key?.remoteJid || m.chat;
    const input = args.join(' ').trim();

    // ── Sample sends ───────────────────────────────────────────────────────
    if (input === 'test' || input === 'samples') {
      const sent = [];
      for (const [key, sample] of Object.entries(SAMPLES)) {
        const ok = await sendAIRichReply(sock, jid, m, {
          markdown: sample.markdown,
          tips: [`NEXORA • AI format audit • ${sample.label}`],
          footer: 'NEXORA • AI format',
        });
        sent.push(`${ok ? '✅' : '❌'} ${sample.label}`);
        if (key !== 'table') await new Promise(r => setTimeout(r, 800));
      }
      return m.reply.info(sent.join('\n'), 'NEXORA • AI format');
    }

    if (SAMPLES[input]) {
      const sample = SAMPLES[input];
      const ok = await sendAIRichReply(sock, jid, m, {
        markdown: sample.markdown,
        tips: [`NEXORA • AI format audit • ${sample.label}`],
        footer: 'NEXORA • AI format',
      });
      if (!ok) return m.reply.error(`Rich render failed — plain path only. Check NEXORA_RICH_RESPONSE and logs.`);
      return;
    }

    // ── Prompt → shape ─────────────────────────────────────────────────────
    if (input) {
      const { shape, directive } = detectRichIntent(input);
      const head = shape
        ? `Prompt maps to *${shape}* — the model gets this extra rule:`
        : 'No rich shape forced — the model answers in normal markdown.';
      const body = directive ? `\n\n_${directive}_` : '';
      return m.reply.info(`${head}${body}`, 'NEXORA • AI format');
    }

    // ── Summary ────────────────────────────────────────────────────────────
    const shapes = [
      ['comparison', 'iPhone vs Galaxy'],
      ['table', 'give me a table of prices'],
      ['steps', 'how to deploy'],
      ['profile', 'who is Kwame Nkrumah'],
    ]
      .map(([shape, example]) => `${detectRichIntent(example).shape === shape ? '✅' : '❌'} ${shape}`)
      .join('\n');
    const rules = RICH_FORMAT_CONTRACT.split('\n').length - 1;

    return m.reply.info(
      `Rich responses: ${capabilities.richResponse ? '✅ ON' : '❌ OFF (NEXORA_RICH_RESPONSE=0)'}\n`
      + `Rendering contract: ${rules} rules appended to every AI system prompt\n\n`
      + `*Shapes detected from the prompt:*\n${shapes}\n\n`
      + `*Try it:*\n`
      + `• \`${p}aiformat compare iPhone 15 vs Galaxy S24\`\n`
      + `• \`${p}aiformat test\` — send all three samples\n`
      + `• \`${p}aiformat who is Kwame Nkrumah\` — a single subject, tailored answer, no table\n`
      + `• \`${p}ai compare MTN vs Telecel data bundles\``,
      'NEXORA • AI format',
    );
  },
};
