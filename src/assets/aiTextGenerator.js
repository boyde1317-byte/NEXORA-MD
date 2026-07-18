import { getAiClient, hasApiKey } from './aiClient.js';
import { NEXORA_SYSTEM_PROMPT } from '../nexora-ai-prompt.js';

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

  async generateText(prompt) {
    const ai = getAiClient();
    console.log(`[AI TEXT GENERATOR] Generating chat response for prompt: "${prompt.slice(0, 80)}..."`);
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: NEXORA_SYSTEM_PROMPT,
      },
    });
    return extractText(response);
  },

  async generateCode(prompt) {
    const ai = getAiClient();
    console.log(`[AI TEXT GENERATOR] Generating code for prompt: "${prompt.slice(0, 80)}..."`);
    const response = await ai.models.generateContent({
      model: CODE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: 'You are Nexora. You provide concise code solutions. Respond with a single fenced code block containing the requested code, followed by at most 2 short sentences of explanation. NEVER use generic AI cliches. NEVER write preamble.',
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
  async brainstormIdeas(topic) {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Brainstorming ideas...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: { parts: [{ text: topic }] },
      config: {
        systemInstruction: 'You are Nexora. Generate a creative, well-organized list of 5 to 10 ideas based on the provided topic. Keep it concise, practical, and highly engaging. Do not use generic AI cliches.',
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
        systemInstruction: 'You are Nexora. Analyze the provided code for bugs, logic errors, or bad practices. Return a summary of issues and a fenced code block with the corrected code. Keep it concise and direct.',
      },
    });
    return extractText(response);
  },


  async analyzeImage(imageBuffer, prompt = 'Describe this image in detail.') {
    const ai = getAiClient();
    console.log('[AI TEXT GENERATOR] Analyzing image...');
    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        },
        prompt
      ],
    });
    return extractText(response);
  },

};

export default aiTextGenerator;
