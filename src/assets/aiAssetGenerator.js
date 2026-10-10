import axios from 'axios';
import { getAiClient } from './aiClient.js';

/**
 * AI image generation with provider fallback:
 *
 *   1. Gemini  — GEMINI_API_KEY + GENERATE_ASSETS=true (preferred when set;
 *                best quality, supports aspect ratios natively)
 *   2. Pollinations.ai — free fallback (image.pollinations.ai). Their
 *                anonymous tier is effectively dead (instant 402s), so a
 *                FREE account key is required: register at
 *                https://auth.pollinations.ai and set POLLINATIONS_TOKEN.
 *                Uses FLUX by default — the best free model for legible
 *                text in logos. Disable the fallback with
 *                POLLINATIONS_ENABLED=false; override the model with
 *                POLLINATIONS_MODEL.
 *
 * Groq (GROQ_API_KEY) is text-only — it has no image endpoint at all, which
 * is why it can never serve these calls and is not attempted here.
 *
 * Boot-time auto-generation of default assets (assetManager.init) is a
 * different thing: it stays gated on Gemini + GENERATE_ASSETS via
 * isBootGenerationEnabled(), so a token-only setup does not silently burn
 * Pollinations on every boot.
 */

const resolveGeminiKey = () => process.env.GEMINI_API_KEY || process.env.NEXORA_AI_KEY || '';

const geminiConfigured = () => !!resolveGeminiKey() &&
  (process.env.GENERATE_ASSETS === 'true' || process.env.GENERATE_ASSETS === true);

const pollinationsEnabled = () => {
  const v = process.env.POLLINATIONS_ENABLED;
  return v === undefined || v === '' || v === 'true' || v === true;
};

const pollinationsToken = () => process.env.POLLINATIONS_TOKEN || process.env.POLLINATIONS_API_KEY || '';

/** Map an "W:H" aspect ratio to Pollinations pixel dims (longest side 1024). */
function pollinationsDims(aspectRatio) {
  const [w, h] = String(aspectRatio || '16:9').split(':').map(Number);
  const valid = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const ratio = valid ? w / h : 16 / 9;
  const base = 1024;
  return ratio >= 1
    ? { width: base, height: Math.round(base / ratio) }
    : { width: Math.round(base * ratio), height: base };
}

async function generateWithPollinations(prompt, aspectRatio) {
  const { width, height } = pollinationsDims(aspectRatio);
  const seed = Math.floor(Math.random() * 1e9);
  const model = process.env.POLLINATIONS_MODEL || 'flux';
  let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  const token = pollinationsToken();
  if (!token) {
    throw new Error('POLLINATIONS_TOKEN is not set — register free at https://auth.pollinations.ai and add the key to .env');
  }
  if (model) url += `&model=${encodeURIComponent(model)}`;

  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000, // was 120s — a hung generation locked the handler for 2 minutes
    maxContentLength: 15 * 1024 * 1024, // hard 15MB payload cap
    headers: {
      'User-Agent': 'NEXORA-MD/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    validateStatus: () => true,
  });
  if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
    throw new Error(`Pollinations rejected the request (HTTP ${resp.status}) — check POLLINATIONS_TOKEN (free key: https://auth.pollinations.ai)`);
  }
  if (resp.status === 429) {
    throw new Error('Pollinations rate limit hit — wait a moment and retry');
  }
  if (resp.status !== 200) {
    throw new Error(`Pollinations returned HTTP ${resp.status}`);
  }
  const buf = Buffer.from(resp.data);
  if (!buf || buf.length < 1000 || buf.length > 15 * 1024 * 1024) {
    throw new Error('Pollinations returned an empty, truncated or oversized image');
  }
  console.log(`[AI ASSET GENERATOR] Pollinations image generated (${width}x${height}).`);
  return buf;
}

export const aiAssetGenerator = {
  /**
   * Whether image generation is available for COMMANDS (.logo, .generateimage,
   * .generateassets). True when Gemini is fully configured OR the keyless
   * Pollinations fallback is enabled (on by default).
   */
  isEnabled() {
    if (geminiConfigured()) return true;
    return pollinationsEnabled() && !!pollinationsToken();
  },

  /**
   * Whether BOOT-TIME auto-generation of default assets is allowed.
   * Deliberately stricter: requires Gemini + GENERATE_ASSETS=true so a
   * keyless setup never burns Pollinations requests on every boot.
   */
  isBootGenerationEnabled() {
    return geminiConfigured();
  },

  /** Human-readable name of the provider the next call will use first. */
  primaryProvider() {
    return geminiConfigured() ? 'gemini' : 'pollinations';
  },

  /**
   * Generates an image from a prompt.
   * @param {string} prompt - Detailed description of the image to generate
   * @param {string} aspectRatio - "16:9", "1:1", "4:3", etc.
   * @returns {Promise<Buffer>} - Image Buffer
   */
  async generateImage(prompt, aspectRatio = '16:9') {
    // ── Keyless fallback path (no Gemini configured) ──────────────────────
    if (!geminiConfigured()) {
      if (!pollinationsEnabled()) {
        throw new Error('Image generation is disabled: set GEMINI_API_KEY + GENERATE_ASSETS=true, or re-enable the keyless fallback with POLLINATIONS_ENABLED=true.');
      }
      return generateWithPollinations(prompt, aspectRatio);
    }

    // ── Gemini first, Pollinations as automatic failure fallback ──────────
    try {
      const ai = getAiClient();
      console.log(`[AI ASSET GENERATOR] Initiating Gemini image generation with prompt: "${prompt}"...`);

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            {
              text: prompt
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio
          }
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('No candidates or content parts returned from Gemini API');
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          console.log('[AI ASSET GENERATOR] Image successfully generated from Gemini.');
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }

      throw new Error('Image data part was not found in the Gemini response');
    } catch (err) {
      if (!pollinationsEnabled()) throw err;
      console.warn(`[AI ASSET GENERATOR] Gemini failed (${err.message || err}) — falling back to Pollinations.`);
      return generateWithPollinations(prompt, aspectRatio);
    }
  }
};

export default aiAssetGenerator;
