/**
 * deepseek.js — .deepseek (aliases .deepsek, .depseek, .dipsek) —
 * DeepSeek chat via DeepInfra.
 *
 * Ported from the LUNA MD plugins/ai-deepseek.js.
 *
 * API KEY — READ THIS BEFORE USING:
 * DeepInfra needs an API key. The LUNA original called the endpoint
 * with NO Authorization header (so it would fail as-is); this port
 * adds the header and the key comes from the clearly-marked placeholder
 * constant below. Put a real DeepInfra API key there (or wire it to an
 * env var) before using the command. The key value is NEVER printed
 * anywhere — not in code, not in replies, not in logs.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; `m.quoted.text` comes from the
 *     NexoraFlex serializer, `text` -> `args.join(' ')`.
 *   - Per-sender conversation history moved from `conn.deepseek` (a
 *     property bolted onto the socket) to a module-level Map keyed by
 *     sender JID — same behaviour, no socket mutation.
 *   - `Authorization: Bearer <key>` header added (see above).
 *   - Branding: NEXORA MD. No owner numbers or channel links.
 */

// TODO (operator): put your DeepInfra API key here.
// Get one at https://deepinfra.com — never share the value or commit
// a real key into the repo. (Placeholder on purpose: the command
// refuses to run until this is replaced.)
const DEEPINFRA_API_KEY = 'YOUR_DEEPINFRA_API_KEY_HERE';

const DEEPINFRA_MODEL = 'deepseek-ai/DeepSeek-V3.2';

// Per-sender conversation history: sender jid -> [{ role, content }]
const deepseekSessions = new Map();

async function deepinfra(model, history) {
  try {
    const res = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({ model, messages: history }),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();

    const teks = [];
    for (const out of data?.choices || []) {
      if (out.message?.content) teks.push(out.message.content);
    }
    return teks.join('\n');
  } catch (e) {
    throw new Error('Error' + e?.message);
  }
}

export default {
  name: 'deepseek',
  aliases: ['deepsek', 'depseek', 'dipsek'],
  category: 'ai',
  description: 'Chat with DeepSeek via DeepInfra (needs a DEEPINFRA_API_KEY). Usage: .deepseek <question>, or reply to a message.',
  cooldown: 5000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const input = m.quoted?.text || args.join(' ').trim();
    if (!input) {
      return await m.reply(`Enter a question or command!\n\nExample:\n${p}deepseek what is AI`);
    }

    if (!DEEPINFRA_API_KEY || DEEPINFRA_API_KEY.startsWith('YOUR_DEEPINFRA_API_KEY_HERE')) {
      return await m.reply(
        '⚠️ DeepSeek is not configured yet.\n' +
        'Set DEEPINFRA_API_KEY at the top of src/plugins/ai/deepseek.js to a DeepInfra API key first.',
      );
    }

    if (!deepseekSessions.has(m.sender)) deepseekSessions.set(m.sender, []);
    const history = deepseekSessions.get(m.sender);
    history.push({ role: 'user', content: input });

    try {
      const res = await deepinfra(DEEPINFRA_MODEL, history);
      history.push({ role: 'assistant', content: res });
      await m.reply(res);
    } catch (err) {
      console.error('[deepseek]', err);
      await m.reply('An error occurred');
    }
  },
};
