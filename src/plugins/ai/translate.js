/**
 * translate.js — AI-powered translation.
 *
 * Uses Gemini for natural, context-aware translations (better than Google
 * Translate's public API for complex sentences). Falls back to the
 * keyless Google Translate endpoint if Gemini is not configured.
 *
 * Usage:
 *   .translate <text>           — auto-detect source, translate to English
 *   .translate fr <text>         — translate to French
 *   .translate en Bonjour         — translate "Bonjour" to English
 *
 * Supports: en, fr, es, de, it, pt, ar, ru, ja, ko, zh, hi, sw, twi, ig, ha, yo
 */
import { aiTextGenerator } from '../../assets/aiTextGenerator.js';
import { translateText } from '../../lib/downloader.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { DownloadProgress } from '../../lib/progress.js';

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', ar: 'Arabic', ru: 'Russian', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese', hi: 'Hindi', sw: 'Swahili', twi: 'Twi', ig: 'Igbo', ha: 'Hausa',
  yo: 'Yoruba', nl: 'Dutch', tr: 'Turkish', pl: 'Polish',
};

export default {
  name: 'translate',
  aliases: ['tr', 'trans'],
  category: 'ai',
  description: 'Translate text. Usage: .translate [lang] <text> — default target: English',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';

    if (!args.length) {
      return await m.reply.info(
        `Usage: \`${p}translate [lang] <text>\`\n\nExamples:\n• \`${p}translate Hello world\` — translate to English\n• \`${p}translate fr Hello world\` — translate to French\n• Reply to a message with \`${p}translate fr\`\n\nSupported: ${Object.entries(LANG_NAMES).map(([c, n]) => `${c}(${n})`).join(', ')}`,
        'NEXORA'
      );
    }

    // Parse: optional language code, then text (or quoted message)
    let targetLang = 'en';
    let text = '';

    const firstArg = args[0]?.toLowerCase();
    if (LANG_NAMES[firstArg]) {
      targetLang = firstArg;
      text = args.slice(1).join(' ').trim();
    } else {
      text = args.join(' ').trim();
    }

    // If no text, use quoted message
    if (!text && m.quoted) {
      text = m.quoted.text;
    }

    if (!text) {
      return await m.reply.error('No text to translate. Provide text or reply to a message.');
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start(`Translating to ${LANG_NAMES[targetLang] || targetLang}`);
      try {
        let result;

        // Prefer Gemini for better quality if available
        if (aiTextGenerator.isEnabled()) {
          const prompt = `Translate the following text to ${LANG_NAMES[targetLang] || targetLang}. Return ONLY the translated text, no explanations:\n\n${text}`;
          result = await aiTextGenerator.generateText(prompt);
        } else {
          // Fallback to Google Translate public API
          result = await translateText(text, targetLang);
        }

        await progress.done();

        await mixedCard(sock, m.from, {
          text: `🌐 *TRANSLATION → ${LANG_NAMES[targetLang] || targetLang.toUpperCase()}*\n\n${result}`,
          footer: 'NEXORA',
        }, [
          { kind: 'copy',   label: '📋 Copy Translation',  value: result },
          { kind: 'action', label: '🔄 Translate Again',  cmd: `${p}translate` },
        ], { quoted: m });
      } catch (err) {
        await progress.fail(`Translation failed: ${err.message}`);
      }
    });
  }
};
