import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { channelPrivilegeLine } from '../../lib/channelPromo.js';

/**
 * Menu template builder.
 *
 * Design rule (2026-09-18 layout pass, owner-directed): command NAMES
 * only, ONE COMMAND PER LINE, grouped by category with UPPERCASE
 * category headers — no descriptions, no inline comma-wrapping. The
 * inline `a, b, c` wrapping read as an unreadable blob on real
 * devices; a per-line directory scans instantly. Detailed help lives
 * in `.help <command>`; the menu is a directory, not documentation.
 *
 * One-box rule (2026-11-16, owner-directed): the menu renders in the
 * single slim box shared by every reply frame (`src/ui/asciiBuilder.js`
 * slimBox) — `╭─「 」` title, `│` walls, `├─` category dividers, fixed
 * `╰────╯` bottom. The old modern/classic/minimal theme borders are
 * gone and the theme setting no longer affects this template. The bot
 * name renders via `brand.display` (a custom bot name stays plain);
 * labels use small caps; the version stays plain.
 */
export const menuTemplate = (menuData) => {
  // Only the brand name renders styled — a custom bot name stays plain.
  const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

  // Compile dynamic variables
  const now = new Date();
  const replacements = {
    '{botName}': displayName(menuData.botName || brand.name),
    '{owner}': menuData.ownerName || owner.ownerName,
    '{runtime}': menuData.runtime || menuData.uptime || '0s',
    '{commands}': menuData.totalCommands || '0',
    '{version}': brand.version,
    '{date}': now.toLocaleDateString(),
    '{time}': now.toLocaleTimeString(),
    '{prefix}': menuData.prefix || '.'
  };

  const parseText = (rawText) => {
    let text = rawText;
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replaceAll(key, value);
    }
    return text;
  };

  const formattedLines = [];

  // ── Header: slim-box title + stat lines ──────────────────────────────
  formattedLines.push(`╭─「 ✦ {botName} ✦ 」`);
  formattedLines.push(`│ 👑 ${toSmallcaps('Owner')}: *{owner}*  ·  v{version}  ·  ⏱ ${toSmallcaps('Up')}: *{runtime}*`);
  formattedLines.push(`│ ⚡ ${toSmallcaps('Prefix')}: *{prefix}*  ·  *{commands}* ${toSmallcaps('commands')}`);

  // ── Categories: divider + one command per line ───────────────────────
  const sortedCategories = Object.keys(menuData.categories).sort();
  let catIndex = 0;
  for (const cat of sortedCategories) {
    catIndex++;
    const cmds = menuData.categories[cat];
    const names = cmds.map(c => `${menuData.prefix || '.'}${c.name}`);
    const header = cat.toUpperCase();

    formattedLines.push(`├─✦ ${String(catIndex).padStart(2, '0')} · ${header} · ${cmds.length}`);
    names.forEach(n => formattedLines.push(`│ ${n}`));
  }

  // ── Footer ───────────────────────────────────────────────────────────
  formattedLines.push('│');
  const circleLine = channelPrivilegeLine(menuData.prefix || '.');
  formattedLines.push(`│ ${circleLine}`);
  formattedLines.push(`│ ${toSmallcaps('Powered by')} ✦ {botName} ✦`);
  formattedLines.push(`╰────────────────────────╯`);

  // Apply placeholders and clean anti-spam spacing/broken characters
  return parseText(formattedLines.join('\n'));
};

export default menuTemplate;
