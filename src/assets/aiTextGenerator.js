import { getAiClient, hasApiKey } from './aiClient.js';
import { buildAISystemPrompt, detectRichIntent } from '../lib/aiRichFormat.js';

// ── Conversation memory ──────────────────────────────────────────────────────
// Per-user conversation history for multi-turn AI chat. Each user gets up to
// MAX_HISTORY message pairs (user + assistant) in a rolling window. Older
// turns are evicted to keep context length manageable for the Gemini API.
const MAX_HISTORY_PAIRS = 6; // 6 pairs = 12 messages max context
const conversationHistory = new Map(); // key: senderJid → [{ role, parts }]

function getHistory(senderJid) {
  return conversationHistory.get(senderJid) || [];
}

function pushHistory(senderJid, role, text) {
  let hist = conversationHistory.get(senderJid);
  if (!hist) {
    hist = [];
    conversationHistory.set(senderJid, hist);
  }
  hist.push({ role, parts: [{ text }] });
  // Trim: keep the last MAX_HISTORY_PAIRS * 2 messages (pairs of user+model)
  const maxMsgs = MAX_HISTORY_PAIRS * 2;
  if (hist.length > maxMsgs) {
    hist.splice(0, hist.length - maxMsgs);
  }
}

export function clearConversation(senderJid) {
  conversationHistory.delete(senderJid);
}

export function getConversationInfo(senderJid) {
  const hist = conversationHistory.get(senderJid) || [];
  return {
    turns: Math.floor(hist.length / 2),
    hasContext: hist.length > 0,
  };
}

const CHAT_MODEL = 'gemini-3.1-flash-lite';
const CODE_MODEL = 'gemini-3.1-flash-lite';

function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text).filter(Boolean).join('\n').trim();
  if (!text) throw new Error('No text was returned from Gemini.');
  return text;
}

export const aiTextGenerator = {
  isEnabled() {
    return hasApiKey();
  },

  async generateText(prompt, { senderJid } = {}) {
    const ai = getAiClient();
    console.log(`[AI TEXT GENERATOR] Generating chat response for prompt: "${prompt.slice(0, 80)}..."`);

    // Build conversation context — if the caller passes a senderJid, we
    // include prior turns so the AI can reference earlier questions/answers.
    const history = senderJid ? getHistory(senderJid) : [];
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: prompt }] },
    ];

    // The system prompt is built per turn: with rich responses on it carries
    // the rendering contract, plus a hard "answer as a table" directive when
    // the user is asking for a comparison.
    const intent = detectRichIntent(prompt);
    if (intent.shape) console.log(`[AI TEXT GENERATOR] rich shape: ${intent.shape}`);

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents,
      config: {
        systemInstruction: buildAISystemPrompt(prompt),
      },
    });
    const reply = extractText(response);

    // Store this turn in conversation history for multi-turn context
    if (senderJid) {
      pushHistory(senderJid, 'user', prompt);
      pushHistory(senderJid, 'model', reply);
    }

    return reply;
  },

  async generateCode(prompt) {
    const ai = getAiClient();
    console.log(`[AI TEXT GENERATOR] Generating code for prompt: "${prompt.slice(0, 80)}..."`);
    const response = await ai.models.generateContent({
      model: CODE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: buildAISystemPrompt(prompt, {
          base: 'You are Nexora. You provide concise code solutions. Respond with a single fenced code block containing the requested code, followed by at most 2 short sentences of explanation. NEVER use generic AI cliches. NEVER write preamble.',
        }),
      },
    });
    return extractText(response);
  },

  async proofreadText(text) {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Proofreading text...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts: [{ text }] },
      config: {
        systemInstruction: 'You are Nexora, a professional proofreader. Fix any spelling, grammar, or punctuation errors in the provided text. Return ONLY the corrected text. Do not add any conversational filler.',
      },
    });
    return extractText(response);
  },
  async writeSong(brief) {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Writing a song...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts: [{ text: brief }] },
      config: {
        systemInstruction:
          'You are Nexora, a professional songwriter. Write an original song based on the user\'s brief. '
          + 'Structure it with labeled sections: [Title], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro] as fitting. '
          + 'Give it a strong hook, vivid imagery, and natural rhythm. Match the mood and genre the user asks for '
          + '(default: afrobeats if unspecified). Keep it singable — no long prose, no explanation, just the song.',
      },
    });
    return extractText(response);
  },
  async brainstormIdeas(topic) {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Brainstorming ideas...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts: [{ text: topic }] },
      config: {
        systemInstruction: buildAISystemPrompt(topic, {
          base: 'You are Nexora. Generate a creative, well-organized list of 5 to 10 ideas based on the provided topic. Use "-" bullets with a short bold lead-in per idea. Keep it concise, practical, and highly engaging. Do not use generic AI cliches.',
        }),
      },
    });
    return extractText(response);
  },
  async debugCode(code) {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Debugging code...');
    const response = await ai.models.generateContent({
      model: CODE_MODEL,
      contents: { parts: [{ text: code }] },
      config: {
        systemInstruction: buildAISystemPrompt(code, {
          base: 'You are Nexora. Analyze the provided code for bugs, logic errors, or bad practices. Open with 2-3 "-" bullets naming the issues, then a fenced code block with the corrected code. Keep it concise and direct.',
        }),
      },
    });
    return extractText(response);
  },


  async analyzeImage(imageBuffer, prompt = 'Describe this image in detail.', mimeType = 'image/jpeg') {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Analyzing image...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType
          }
        },
        prompt
      ],
    });
    return extractText(response);
  },

};

export default aiTextGenerator;
