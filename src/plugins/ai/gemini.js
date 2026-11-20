/**
 * gemini.js — .gemini <prompt> — AI chat via keyless Pollinations text API.
 *
 * Ported from luna-md/plugins/gemini.js. Uses global fetch (axios is not
 * a NexoraFlex dependency). The `ai` alias is DROPPED — NexoraFlex owns
 * .ai (src/plugins/ai/ai.js). The system prompt is rebranded to
 * NEXORA MD. The Meta-AI-style code-block formatting (bare HTML/JS is
 * wrapped in ``` blocks so WhatsApp shows a copy button) is kept as-is.
 * m.text prefix-stripping is replaced with args from the execute context.
 */

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

async function askAI(prompt) {
  const system = 'You are NEXORA MD by moonson. When user asks for code, you MUST output ONLY in markdown code blocks like ```html or ```javascript. Never output raw html without backticks. Example: ```html\n<!DOCTYPE html>...\n```';
  const full = `${system}\n\nUser: ${prompt}`;
  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(full)}`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.text();
    if (data && data.length > 20) return data.trim();
  } catch (_) {}
  return null;
}

function fixToMetaAIStyle(text) {
  if (!text) return text;
  // If it already has ``` then it is fine
  if (text.includes('```')) return text;

  // If there is HTML without a block - wrap it in a block
  if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<head>')) {
    const idx = text.indexOf('<!DOCTYPE') !== -1 ? text.indexOf('<!DOCTYPE') : text.indexOf('<html');
    if (idx !== -1) {
      const before = text.slice(0, idx).trim();
      const code = text.slice(idx).trim();
      return `${before}\n\n\`\`\`html\n${code}\n\`\`\``;
    }
  }
  // If it is JavaScript code without a block
  if (text.includes('function') || ((text.includes('const ') || text.includes('let ')) && text.length > 100)) {
    return `\`\`\`javascript\n${text}\n\`\`\``;
  }
  return text;
}

const FALLBACK_MENU = 'Here\'s a quick, copy-ready example of a responsive navigation menu:\n\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>My Menu</title>\n<style>\nbody{font-family:Arial;margin:0}\n.navbar{background:#333;color:#fff;display:flex;justify-content:space-between;padding:0.5rem 1rem}\n</style>\n</head>\n<body>\n<nav class="navbar"><div class="brand">MySite</div></nav>\n</body>\n</html>\n```';

export default {
  name: 'gemini',
  aliases: [],
  category: 'ai',
  description: 'Ask the AI anything — code answers come back in copyable blocks. Usage: .gemini <your question>',
  cooldown: 5000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const prompt = args.join(' ').trim();
    if (!prompt) return await m.reply(`🤖 *NEXORA MD* 👑 moonson\n\n> ${p}gemini give me a menu code`);

    await m.react('⏳').catch(() => {});

    let reply = await askAI(prompt);
    if (!reply) reply = FALLBACK_MENU;
    reply = fixToMetaAIStyle(reply);

    // This is what makes WhatsApp show it like Meta AI - a block with a copy button
    await m.reply(reply);
    await m.react('✅').catch(() => {});
  },
};
