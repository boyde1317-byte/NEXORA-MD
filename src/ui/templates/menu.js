import { themeManager } from '../themeManager.js';
import { layoutConfig } from '../../../config/layout.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

/**
 * Menu template builder.
 *
 * Design rule (2026-09 declutter pass): the menu lists command NAMES
 * only, inline and wrapped — no per-command borders, no per-command
 * descriptions, no per-command blank lines. The old layout rendered a
 * border line + a full smallcaps description for every one of ~150
 * commands, producing a 400-line ASCII wall. Detailed help lives in
 * `.help <command>`; the menu is a directory, not documentation.
 *
 * Kept: themed borders, smallcaps typographic identity, per-category
 * section headers with counts, stat header, and the placeholder system.
 */
export const menuTemplate = (menuData) => {
  const borders = themeManager.getBorders();
  const styleName = themeManager.getTheme();
  const bulletIcon = layoutConfig.icons.bullet;

  // Compile dynamic variables
  const now = new Date();
  const replacements = {
    '{botName}': menuData.botName || brand.name,
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

  /**
   * Wrap command names into compact inline rows.
   * 'a, b, c' joined with ', ' and greedily broken at maxWidth so the
   * left border rule stays aligned on narrow phone screens.
   */
  const wrapNames = (names, maxWidth = 38) => {
    const rows = [];
    let row = '';
    for (const name of names) {
      if (row && (row + ', ' + name).length > maxWidth) {
        rows.push(row);
        row = name;
      } else {
        row = row ? row + ', ' + name : name;
      }
    }
    if (row) rows.push(row);
    return rows;
  };

  const formattedLines = [];

  // ── Header ───────────────────────────────────────────────────────────
  if (styleName === 'minimal') {
    formattedLines.push(`── {botName} ──`);
    formattedLines.push(` Owner: {owner} · v{version} · Up: {runtime}`);
    formattedLines.push(` Prefix: {prefix} · Commands: {commands}`);
  } else if (styleName === 'classic') {
    formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃  ✦ {botName} ✦`);
    formattedLines.push(`┃  {owner} · v{version} · Up: {runtime}`);
    formattedLines.push(`┃  Prefix: {prefix} · Commands: {commands}`);
    formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else {
    // Modern — one compact stat block, no double-spacing
    formattedLines.push(`${borders.topLeft}✦ {botName} ✦`);
    formattedLines.push(`${borders.line} Owner: {owner} · v{version} · Up: {runtime}`);
    formattedLines.push(`${borders.line} Prefix: {prefix} · {commands} ${toSmallcaps('commands')}`);
  }

  // ── Categories: header + inline name rows ────────────────────────────
  const sortedCategories = Object.keys(menuData.categories).sort();
  let catIndex = 0;
  for (const cat of sortedCategories) {
    catIndex++;
    const cmds = menuData.categories[cat];
    const names = cmds.map(c => c.name);
    const rows = wrapNames(names, styleName === 'minimal' ? 48 : 36);

    if (styleName === 'minimal') {
      formattedLines.push('');
      formattedLines.push(`── ${cat} (${cmds.length}) ──`);
      rows.forEach(r => formattedLines.push(r));
    } else if (styleName === 'classic') {
      formattedLines.push(`┃  ✦ ${toSmallcaps(cat)} · ${cmds.length}`);
      rows.forEach(r => formattedLines.push(`${borders.line} ${r}`));
    } else {
      formattedLines.push(`${borders.divider}✦ ${String(catIndex).padStart(2, '0')} · ${toSmallcaps(cat)} · ${cmds.length}`);
      rows.forEach(r => formattedLines.push(`${borders.line} ${r}`));
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────
  formattedLines.push('');
  if (styleName === 'classic') {
    formattedLines.push(`┃  ${toSmallcaps('Powered by')} ✦ {botName} ✦`);
    formattedLines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else if (styleName === 'minimal') {
    formattedLines.push(`Powered by ✦ {botName} ✦`);
  } else {
    formattedLines.push(`${borders.bottomLeft}── ${toSmallcaps('Powered by')} ✦ {botName} ✦ ──`);
  }

  // Apply placeholders and clean anti-spam spacing/broken characters
  return parseText(formattedLines.join('\n'));
};

export default menuTemplate;
