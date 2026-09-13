/**
 * translate.js — AI-powered translation.
 *
 * Uses Gemini for natural, context-aware translations (better than Google
 * Translate's public API for complex sentences). Falls back to the
 * keyless Google Translate endpoint if Gemini is not configured — that
 * fallback auto-detects the SOURCE language, which we surface in the card.
 *
 * NOTE: this used to be shadowed by a second-rate duplicate plugin
 * (web/translate.js, MyMemory API) that silently overwrote this command
 * at load time — last registration wins. That duplicate is removed and
 * the loader now warns on duplicate command names.
 *
 * Usage:
 *   .translate <text>           — auto-detect source, translate to English
 *   .translate fr <text>        — translate to French
 *   .translate french <text>    — full names resolve too
 *   .translate <text> (reply)   — or reply to a message with .translate [lang]
 *
 * Supported: en, fr, es, de, it, pt, ar, ru, ja, ko, zh, hi, sw, twi, ig, ha, yo, + more
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
  yo: 'Yoruba', nl: 'Dutch', tr: 'Turkish', pl: 'Polish', id: 'Indonesian',
  ur: 'Urdu', bn: 'Bengali', ta: 'Tamil', fa: 'Persian', vi: 'Vietnamese',
  th: 'Thai', el: 'Greek', he: 'Hebrew', uk: 'Ukrainian', sv: 'Swedish',
};

/** Reverse map: 'french' → 'fr', 'French' → 'fr' (case-insensitive values). */
const NAME_TO_CODE = Object.fromEntries(
  Object.entries(LANG_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

/** Resolve a user-supplied arg to a language code, or null. */
function resolveLang(arg) {
  if (!arg) return null;
  const a = arg.toLowerCase();
  return LANG_NAMES[a] ? a : (NAME_TO_CODE[a] || null);
}

export default {
  name: 'translate',
  aliases: ['tr', 'trans', 'translator'],
  category: 'ai',
  description: 'Translate text. Usage: .translate [lang] <text> — default target: English',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix }) => {
    const p = prefix || '.';

    if (!args.length) {
      return await m.reply.info(
        `Usage: \`${p}translate [lang] <text>\`\n\nExamples:\n• \`${p}translate Hello world\` — translate to English\n• \`${p}translate fr Hello world\` — translate to French\n• \`${p}translate french Bonjour\` — full names work too\n• Reply to a message with \`${p}translate fr\`\n\nSupported: ${Object.entries(LANG_NAMES).map(([c, n]) => `${c}(${n})`).join(', ')}`,
        'NEXORA • Translate'
      );
    }

    // Parse: optional language (code or full name), then text (or quoted message)
    let targetLang = 'en';
    let text = '';

    const firstArg = args[0];
    const resolved = resolveLang(firstArg);
    if (resolved) {
      targetLang = resolved;
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
        let detectedFrom = null;

        if (aiTextGenerator.isEnabled()) {
          const prompt =
            `Translate the following text to ${LANG_NAMES[targetLang] || targetLang}. ` +
            'Preserve original formatting and line breaks. Return ONLY the translated text, no explanations:\n\n' +
            text;
          result = await aiTextGenerator.generateText(prompt);
        } else {
          // Fallback to Google Translate public API — returns { text, from }
          // ('from' is the auto-detected source language code).
          const out = await translateText(text, targetLang);
          result = out.text;
          detectedFrom = out.from && out.from !== targetLang ? out.from : null;
        }

        await progress.done();

        const fromLabel = detectedFrom
          ? `${LANG_NAMES[detectedFrom] || detectedFrom.toUpperCase()} → `
          : '';
        const toLabel = LANG_NAMES[targetLang] || targetLang.toUpperCase();

        await mixedCard(sock, m.from, {
          text: `🌐 *${fromLabel}${toLabel}*\n\n${result}`,
          footer: `NEXORA • ${aiTextGenerator.isEnabled() ? 'Gemini' : 'Google'} Translate`,
        }, [
          { kind: 'copy',   label: '📋 Copy Translation', value: result },
          { kind: 'action', label: `🔁 Again (${toLabel})`, cmd: `${p}translate ${targetLang}` },
        ], { quoted: m });
      } catch (err) {
        await m.reply.error(`Translation failed: ${err.message}`);
        throw err;
      }
    });
  },
};
