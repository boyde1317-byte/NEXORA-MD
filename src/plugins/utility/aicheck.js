/**
 * aicheck.js — .aicheck (alias .aidetect) — AI-text detector.
 *
 * Ported from the LUNA MD plugins/aicheck.js. Tries three keyless
 * free endpoints in order (Originality.ai free tool, Writer.com,
 * ZeroGPT), then falls back to a local heuristic so it never stays
 * at 0%. The local fallback is a rough signal, not a verdict.
 *
 * Differences from the LUNA original:
 *   - ESM + NexoraFlex plugin contract; axios replaced by global fetch
 *     (axios is not a direct NexoraFlex dependency).
 *   - `conn.reply` / `conn.sendMessage` react -> `m.reply` /
 *     `sock.sendMessage` react; `m.chat` -> `m.from`.
 *   - The Indonesian buzzwords in localDetect are translated to
 *     English (same scoring: +6 per match). Note the list still holds
 *     very common words ("as", "very", "with", "that") — that is
 *     faithful to the original, which listed their Indonesian
 *     equivalents ("sebagai", "sangat", "dengan", "yang"); the
 *     heuristic is weak by design and the remote endpoints are the
 *     real check.
 *   - Branding: NEXORA MD. No owner numbers, keys, or channel links.
 */
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

// Local detection if the sites fail
function localDetect(text) {
  const lower = text.toLowerCase();
  let score = 15;
  const buzz = [
    'artificial intelligence', 'technology', 'has revolutionized', 'revolution',
    'digital world', 'professional', 'experienced', 'in writing',
    'the way we', 'interact', 'important for', 'as', 'is a', 'very',
    'article', 'currently', 'with', 'that',
  ];
  buzz.forEach((w) => { if (lower.includes(w)) score += 6; });
  const words = text.split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5).length || 1;
  const avg = words / sentences;
  if (avg > 18) score += 20;
  else if (avg > 12) score += 10;
  if (words > 50) score += 10;
  if (!/[😂😭😅🔥👍❤️]/.test(text)) score += 8; // Formal text = more likely AI
  if (/[.!?]$/.test(text.trim())) score += 5;
  return Math.min(92, Math.max(5, score));
}

async function postJson(url, body, headers, timeoutMs = 10000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'user-agent': UA, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

async function tryOriginality(q) {
  try {
    const data = await postJson(
      'https://api.originality.ai/api/v2-tools/free-tools/ai-scan',
      { content: q },
      {
        accept: '*/*',
        'content-type': 'application/json',
        origin: 'https://corefreetools.originality.ai',
        referer: 'https://corefreetools.originality.ai/',
      },
    );
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    if (d.ai !== undefined) return { ai: d.ai * 100, human: d.original * 100, src: 'Originality.ai' };
  } catch (e) {
    if (String(e.message || '').includes('<!DOCTYPE')) throw new Error('CF');
  }
  return null;
}

async function tryWriter(q) {
  try {
    const data = await postJson(
      'https://api.writer.com/api/v2/ai-content-detection',
      { input: q },
      { 'content-type': 'application/json', origin: 'https://writer.com' },
    );
    const score = data.data?.[0]?.ai_score ?? data.score ?? null;
    if (score !== null) return { ai: score * 100, human: (1 - score) * 100, src: 'Writer.com' };
  } catch (_) {}
  return null;
}

async function tryZeroGPT(q) {
  try {
    const data = await postJson(
      'https://api.zerogpt.com/api/detect/detectText',
      { input_text: q },
      { 'content-type': 'application/json' },
    );
    const ai = data.data?.fakePercentage ?? data.fakePercentage ?? null;
    if (ai !== null) return { ai, human: 100 - ai, src: 'ZeroGPT' };
  } catch (_) {}
  return null;
}

export default {
  name: 'aicheck',
  aliases: ['aidetect'],
  category: 'utility',
  description: 'Check whether text looks AI-written (Originality / Writer / ZeroGPT + local fallback). Usage: .aicheck <text, min 20 chars>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';
    const text = args.join(' ').trim() || m.quoted?.text || '';
    if (!text || text.trim().length < 20) {
      return await m.reply(
        '*AI CHECK*\n\n❌ Text too short!\nMinimum 20 characters / 5 words.\n\nExample:\n' +
        `${p}aicheck Hello I am a professional writer who writes about AI technology`,
      );
    }
    if (text.trim().split(/\s+/).length < 5) {
      return await m.reply(`❌ Minimum 5 words, you only sent ${text.trim().split(/\s+/).length} words.`);
    }

    try { await sock.sendMessage(m.from, { react: { text: '🔍', key: m.key } }); } catch (_) {}

    let result = null;
    try { result = await tryOriginality(text); } catch (_) {}
    if (!result) result = await tryWriter(text);
    if (!result) result = await tryZeroGPT(text);

    // Smart local fallback - so it never stays at 0%
    if (!result || result.ai === 0) {
      const localScore = localDetect(text);
      result = { ai: localScore, human: 100 - localScore, src: 'Local Heuristic (CF Bypass)' };
    }

    const ai = result.ai;
    const human = result.human;
    const barFilled = Math.round(ai / 10);
    const bar = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled);

    let verdict;
    let emoji;
    if (ai >= 80) { verdict = 'AI DETECTED - 100% AI-made'; emoji = '🔴'; }
    else if (ai >= 60) { verdict = 'MIXED - AI & Human mix'; emoji = '🟠'; }
    else if (ai >= 35) { verdict = 'LIKELY MIXED - Possibly AI'; emoji = '🟡'; }
    else if (ai >= 15) { verdict = 'LIKELY HUMAN'; emoji = '🟢'; }
    else { verdict = 'HUMAN - Written by a human'; emoji = '✅'; }

    const msg = `${emoji} *AI DETECTOR - ${result.src}*\n\n` +
      `${bar} *${ai.toFixed(2)}% AI*\n\n` +
      `> 🤖 *AI:* ${ai.toFixed(2)}%\n` +
      `> 👤 *Human:* ${human.toFixed(2)}%\n` +
      `> 📊 *Verdict:* ${verdict}\n` +
      `> 📝 *Words:* ${text.split(/\s+/).length}\n` +
      `> 🔤 *Characters:* ${text.length}\n` +
      `> 📄 *Text:* ${text.slice(0, 150)}${text.length > 150 ? '...' : ''}\n\n` +
      '*Powered by NEXORA MD*\n';

    await m.reply(msg);
    try { await sock.sendMessage(m.from, { react: { text: emoji, key: m.key } }); } catch (_) {}
  },
};
