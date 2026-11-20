/**
 * translate2.js — .translate2 — AI translate (keyless providers).
 *
 * Ported from the LUNA MD plugins/#U062a#U0631#U062c#U0645.js
 * (command `tr` / `translate`). NexoraFlex already ships
 * src/plugins/ai/translate.js, so this one is `translate2`.
 *
 * Provider chain (tried in order until one succeeds, all keyless):
 * Google gtx -> Google dict-chrome -> MyMemory -> Lingva ->
 * Pollinations (POST) -> Pollinations (GET).
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch
 *     (axios is not a direct NexoraFlex dependency).
 *   - `conn.reply` / `conn.sendMessage` react -> `m.reply` /
 *     `sock.sendMessage` react; `m.chat` -> `m.from`.
 *   - Quoted text comes from `m.quoted?.text` (NexoraFlex serializer).
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

const NAMES = {
  ar: 'Arabic', en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', hi: 'Hindi', id: 'Indonesian', nl: 'Dutch',
  fa: 'Persian', ur: 'Urdu', he: 'Hebrew', pl: 'Polish', sv: 'Swedish',
};

const ALIASES = {
  arabic: 'ar', english: 'en', french: 'fr', spanish: 'es', german: 'de',
  italian: 'it', turkish: 'tr', russian: 'ru', chinese: 'zh', japanese: 'ja',
  korean: 'ko', hindi: 'hi',
};

function resolveLang(word = '') {
  const w = word.toLowerCase();
  if (NAMES[w]) return w;
  if (ALIASES[w]) return ALIASES[w];
  return null;
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  return await res.json();
}

// ===== Providers (tried in order until one succeeds) =====
const providers = [
  {
    name: 'google',
    run: async (text, code) => {
      const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: code, dt: 't', q: text });
      const data = await fetchJson(`https://translate.googleapis.com/translate_a/single?${params}`);
      return data?.[0]?.map((s) => s?.[0] || '').join('');
    },
  },
  {
    name: 'google2',
    run: async (text, code) => {
      const params = new URLSearchParams({ client: 'dict-chrome-ex', sl: 'auto', tl: code, q: text });
      const data = await fetchJson(`https://clients5.google.com/translate_a/t?${params}`);
      const r = data?.[0];
      return Array.isArray(r) ? r[0] : r;
    },
  },
  {
    name: 'mymemory',
    run: async (text, code) => {
      const params = new URLSearchParams({ q: text.slice(0, 500), langpair: `autodetect|${code}` });
      const data = await fetchJson(`https://api.mymemory.translated.net/get?${params}`);
      return data?.responseData?.translatedText;
    },
  },
  {
    name: 'lingva',
    run: async (text, code) => {
      const data = await fetchJson(
        `https://lingva.ml/api/v1/auto/${code}/${encodeURIComponent(text)}`,
      );
      return data?.translation;
    },
  },
  {
    name: 'pollinations',
    run: async (text, code) => {
      const data = await fetchJson(
        'https://text.pollinations.ai/openai',
        {
          method: 'POST',
          headers: { 'user-agent': UA, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'openai',
            messages: [
              {
                role: 'system',
                content: `You are a professional translator. Translate the user's text to ${NAMES[code]}. Output ONLY the translation, with no explanations, notes, quotes, or markdown. Keep the original formatting, emojis, and line breaks.`,
              },
              { role: 'user', content: text },
            ],
          }),
        },
        25000,
      );
      return data?.choices?.[0]?.message?.content;
    },
  },
  {
    name: 'pollinations-get',
    run: async (text, code) => {
      const prompt = `Translate to ${NAMES[code]}. Output ONLY the translation:\n\n${text}`;
      const res = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
        { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) },
      );
      const data = await res.text();
      return typeof data === 'string' ? data : null;
    },
  },
];

async function translate(text, code) {
  const errors = [];
  for (const p of providers) {
    try {
      const out = (await p.run(text, code))?.toString().trim();
      if (out) return { out, by: p.name, errors };
      errors.push(`${p.name}: empty`);
    } catch (e) {
      const why = e.message || String(e);
      errors.push(`${p.name}: ${why}`);
      console.error(`[translate2] ${p.name}:`, why);
    }
  }
  return { out: null, errors };
}

export default {
  name: 'translate2',
  aliases: [],
  category: 'ai',
  description: 'Translate text to another language (keyless). Usage: .translate2 <lang> <text>, or reply to a message.',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const rawArgs = [...args];

    // Determine the target language (default: English)
    let code = 'en';
    if (rawArgs.length) {
      const found = resolveLang(rawArgs[0]);
      if (found) {
        code = found;
        rawArgs.shift();
      }
    }

    // Text: from the command or from the quoted message
    const quoted = m.quoted?.text || m.quoted?.caption || '';
    const input = (rawArgs.join(' ').trim() || quoted).trim();

    if (!input) {
      return await m.reply(
        `🌐 *NEXORA MD*\n\n> ${p}translate2 ar hello how are you\n> ${p}translate2 fr (reply to a message)\n\nLanguages: ${Object.keys(NAMES).join(', ')}`,
      );
    }

    if (input.length > 3000) return await m.reply('❌ Text is too long (limit 3000 characters)');

    try { await sock.sendMessage(m.from, { react: { text: '⏳', key: m.key } }); } catch (_) {}

    const { out, errors } = await translate(input, code);

    if (!out) {
      try { await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } }); } catch (_) {}
      // Show why each provider failed, to find the problem
      return await m.reply(`❌ Translation failed\n\n${errors.map((e) => `• ${e}`).join('\n')}`);
    }

    await m.reply(`🌐 *${NAMES[code]}* (${code})\n\n${out}\n\n> NEXORA MD`);
    try { await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } }); } catch (_) {}
  },
};
