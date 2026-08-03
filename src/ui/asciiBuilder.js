import { toSmallcaps } from '../lib/smallcaps.js';

/**
 * ASCII box builder for structured text output.
 *
 * Uses smallcaps for titles to match the menu system's visual identity.
 * Accent symbol ✦ wraps every title for brand consistency.
 */
export const asciiBuilder = {
  box(title, lines = []) {
    const formatted = [];
    if (title) {
      formatted.push(`✦ *${toSmallcaps(title)}* ✦\n`);
    }
    lines.forEach(line => formatted.push(line));
    return formatted.join('\n');
  },

  list(title, items = []) {
    const formatted = [];
    if (title) {
      formatted.push(`✦ *${toSmallcaps(title)}* ✦\n`);
    }
    items.forEach(item => formatted.push(`✦ ${item}`));
    return formatted.join('\n');
  },

  card(title, entries = []) {
    const formatted = [];
    if (title) {
      formatted.push(`✦ *${toSmallcaps(title)}* ✦\n`);
    }
    entries.forEach(entry => formatted.push(`• ${entry}`));
    return formatted.join('\n');
  },
};

export default asciiBuilder;
