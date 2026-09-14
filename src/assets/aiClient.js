import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Single shared Gemini client factory. Every AI-related feature in this bot
 * (image generation, chat, code generation, etc.) MUST go through this
 * module — never instantiate a separate client or call another AI provider
 * (e.g. an external integrations proxy) directly. This keeps API-key
 * sourcing (`GEMINI_API_KEY` from `.env`) and the `aistudio-build`
 * User-Agent identification in exactly one place.
 */

let aiClient = null;

// Key resolution: GEMINI_API_KEY (canonical) with NEXORA_AI_KEY as the
// platform-managed alias. Either name powers every AI feature.
const resolveApiKey = () => process.env.GEMINI_API_KEY || process.env.NEXORA_AI_KEY || '';

export function hasApiKey() {
  return !!resolveApiKey();
}

export function getAiClient() {
  if (aiClient) return aiClient;

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error('AI key is not defined in the environment. Set GEMINI_API_KEY (or NEXORA_AI_KEY) in .env');
  }

  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  return aiClient;
}

export default { getAiClient, hasApiKey };
