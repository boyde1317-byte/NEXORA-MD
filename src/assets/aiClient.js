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

export function hasApiKey() {
  return !!process.env.GEMINI_API_KEY;
}

export function getAiClient() {
  if (aiClient) return aiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment');
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
