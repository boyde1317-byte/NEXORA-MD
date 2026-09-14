import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Single shared AI client factory. Every AI-related feature in this bot
 * (image generation, chat, code generation, etc.) MUST go through this
 * module — never instantiate a separate client or call another AI provider
 * directly. This keeps API-key sourcing in exactly one place.
 *
 * Providers, in priority order:
 *   1. Gemini      — GEMINI_API_KEY / NEXORA_AI_KEY (native SDK, also
 *                    the ONLY provider that can generate images)
 *   2. Groq        — GROQ_API_KEY       (free tier, console.groq.com)
 *   3. Mistral     — MISTRAL_API_KEY    (free tier, console.mistral.ai)
 *   4. OpenRouter  — OPENROUTER_API_KEY (:free models)
 *
 * Providers 2-4 are OpenAI-compatible and served through one adapter that
 * exposes the Gemini call surface (models.generateContent), so consumers
 * don't change. All model IDs are env-overridable (GROQ_MODEL,
 * GROQ_VISION_MODEL, MISTRAL_MODEL, ..., OPENROUTER_MODEL).
 */

let aiClient = null;

const resolveGeminiKey = () => process.env.GEMINI_API_KEY || process.env.NEXORA_AI_KEY || '';

const PROVIDERS = [
  {
    name: 'gemini',
    kind: 'gemini',
    hasKey: () => !!resolveGeminiKey(),
  },
  {
    name: 'groq',
    kind: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    resolveKey: () => process.env.GROQ_API_KEY || '',
    textModel: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel: () => process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  {
    name: 'mistral',
    kind: 'openai-compat',
    baseUrl: 'https://api.mistral.ai/v1',
    resolveKey: () => process.env.MISTRAL_API_KEY || '',
    textModel: () => process.env.MISTRAL_MODEL || 'mistral-large-latest',
    visionModel: () => process.env.MISTRAL_VISION_MODEL || 'pixtral-large-latest',
  },
  {
    name: 'openrouter',
    kind: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    resolveKey: () => process.env.OPENROUTER_API_KEY || '',
    textModel: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    visionModel: () => process.env.OPENROUTER_VISION_MODEL || 'meta-llama/llama-4-scout:free',
  },
];

const activeProvider = () => PROVIDERS.find((p) => (p.kind === 'gemini' ? p.hasKey() : !!p.resolveKey())) || null;

export function hasApiKey() {
  return !!activeProvider();
}

export function getActiveProviderName() {
  return activeProvider()?.name || null;
}

/* ---------- Gemini-shape normalization (shared helpers) ---------- */

// Accepts every shape callers use: plain string, {parts:[...]},
// [{role, parts:[...]}] multi-turn, or a bare array of raw parts.
function normalizeContents(contents) {
  const turns = [];
  const pushTurn = (role, parts) => turns.push({ role, parts: parts.filter((p) => p?.text || p?.inlineData) });

  if (typeof contents === 'string') {
    pushTurn('user', [{ text: contents }]);
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === 'string') pushTurn('user', [{ text: item }]);
      else if (Array.isArray(item?.parts)) pushTurn(item.role === 'model' ? 'model' : item.role || 'user', item.parts);
      else if (item?.text || item?.inlineData) pushTurn('user', [item]);
    }
  } else if (contents?.parts) {
    pushTurn(contents.role === 'model' ? 'model' : contents.role || 'user', contents.parts);
  } else if (contents?.text || contents?.inlineData) {
    pushTurn('user', [contents]);
  }
  return turns;
}

function systemInstructionToText(systemInstruction) {
  if (!systemInstruction) return '';
  if (typeof systemInstruction === 'string') return systemInstruction;
  return (systemInstruction.parts || []).map((p) => p.text).filter(Boolean).join('\n');
}

// Gemini contents -> OpenAI messages. Returns { messages, hasImage }.
function toOpenAiMessages(contents, systemInstruction) {
  const messages = [];
  const sys = systemInstructionToText(systemInstruction);
  if (sys) messages.push({ role: 'system', content: sys });

  let hasImage = false;
  for (const turn of normalizeContents(contents)) {
    const parts = [];
    for (const p of turn.parts) {
      if (p.text) parts.push({ type: 'text', text: p.text });
      else if (p.inlineData?.data) {
        hasImage = true;
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${p.inlineData.mimeType || 'image/jpeg'};base64,${p.inlineData.data}` },
        });
      }
    }
    messages.push({
      role: turn.role === 'model' ? 'assistant' : turn.role,
      content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts,
    });
  }
  return { messages, hasImage };
}

// OpenAI chat completion -> Gemini response shape
// ({ candidates: [{ content: { parts: [{ text }] } }] }) so every
// consumer's extractText() keeps working.
function toGeminiShape(openaiResponse) {
  const choice = openaiResponse?.choices?.[0]?.message;
  const text = typeof choice?.content === 'string' ? choice.content
    : Array.isArray(choice?.content) ? choice.content.map((c) => c?.text).filter(Boolean).join('\n')
    : '';
  return {
    text,
    candidates: [{ content: { parts: text ? [{ text }] : [] }, role: 'model' }],
  };
}

/* ---------- OpenAI-compatible adapter ---------- */

function buildOpenAiCompatClient(provider) {
  return {
    models: {
      async generateContent({ model, contents, config }) {
        // Image GENERATION is Gemini-only (no open provider ships it).
        if (config?.imageConfig || (model || '').includes('image')) {
          throw new Error('Image generation requires GEMINI_API_KEY (Google AI Studio). Text providers (Groq/Mistral/OpenRouter) cannot generate images.');
        }

        const { messages, hasImage } = toOpenAiMessages(contents, config?.systemInstruction);
        // Gemini-* model names map to this provider's default (vision
        // variant when the request carries an image); explicit foreign
        // model IDs are passed through untouched.
        const mappedModel = (model || '').startsWith('gemini')
          ? (hasImage ? provider.visionModel() : provider.textModel())
          : (model || provider.textModel());

        const body = { model: mappedModel, messages };
        if (config?.maxOutputTokens) body.max_tokens = config.maxOutputTokens;
        if (typeof config?.temperature === 'number') body.temperature = config.temperature;

        const res = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.resolveKey()}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`${provider.name} API error ${res.status}: ${String(detail).slice(0, 300)}`);
        }
        return toGeminiShape(await res.json());
      },
    },
  };
}

export function getAiClient() {
  if (aiClient) return aiClient;

  const provider = activeProvider();
  if (!provider) {
    throw new Error('No AI provider configured. Set GEMINI_API_KEY / NEXORA_AI_KEY (Google AI Studio) — or GROQ_API_KEY (free key at console.groq.com) / MISTRAL_API_KEY / OPENROUTER_API_KEY — in .env');
  }

  if (provider.kind === 'gemini') {
    aiClient = new GoogleGenAI({
      apiKey: resolveGeminiKey(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } else {
    aiClient = buildOpenAiCompatClient(provider);
  }

  return aiClient;
}

export default { getAiClient, hasApiKey, getActiveProviderName };
