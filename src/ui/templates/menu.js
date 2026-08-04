import { themeManager } from '../themeManager.js';
import { layoutConfig } from '../../../config/layout.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { asciiBuilder } from '../asciiBuilder.js';

/**
 * Enhanced menu template builder.
 *
 * Generates visually striking command listings with:
 * - Themed border characters (modern / classic / minimal)
 * - Smallcaps labels for a premium typographic identity
 * - Per-category command counts and visual dividers
 * - Stat row headers for system info
 * - Accent symbols flanking section titles
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

  const formattedLines = [];

  // ── Header Box with System Stats ────────────────────────────────────
  if (styleName === 'minimal') {
    formattedLines.push(`\u2500\u2500 {botName} \u2500\u2500`);
    formattedLines.push(` ${toSmallcaps('Owner')}: {owner}`);
    formattedLines.push(` ${toSmallcaps('Version')}: {version} | ${toSmallcaps('Runtime')}: {runtime}`);
    formattedLines.push(` ${toSmallcaps('Prefix')}: {prefix} | ${toSmallcaps('Commands')}: {commands}`);
  } else if (styleName === 'classic') {
    formattedLines.push(`\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
    formattedLines.push(`\u2503  \u2726 {botName} \u2726`);
    formattedLines.push(`\u2503  ${toSmallcaps('Owner')}: {owner} | ${toSmallcaps('Ver')}: {version}`);
    formattedLines.push(`\u2503  ${toSmallcaps('Uptime')}: {runtime} | ${toSmallcaps('Prefix')}: {prefix}`);
    formattedLines.push(`\u2503  ${toSmallcaps('Total Commands')}: {commands}`);
    formattedLines.push(`\u2503\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
  } else {
    // Modern — enhanced with accent symbols and stat row layout
    formattedLines.push(`${borders.topLeft}\u2726 {botName} \u2726`);
    formattedLines.push(`${borders.line}`);
    formattedLines.push(`${borders.line} \u25B8 ${toSmallcaps('Owner')}: {owner}`);
    formattedLines.push(`${borders.line} \u25B8 ${toSmallcaps('Version')}: {version}`);
    formattedLines.push(`${borders.line} \u25B8 ${toSmallcaps('Runtime')}: {runtime}`);
    formattedLines.push(`${borders.line} \u25B8 ${toSmallcaps('Prefix')}: {prefix}`);
    formattedLines.push(`${borders.line} \u25B8 ${toSmallcaps('Total Commands')}: {commands}`);
  }

  // ── Visual Separator ────────────────────────────────────────────────
  formattedLines.push('');

  // ── Iterate categories and format command lists ─────────────────────
  const sortedCategories = Object.keys(menuData.categories).sort();
  let catIndex = 0;
  for (const cat of sortedCategories) {
    catIndex++;
    const cmdCount = menuData.categories[cat].length;

    if (styleName === 'minimal') {
      formattedLines.push(`\u2500\u2500 ${toSmallcaps(cat)} (${cmdCount}) \u2500\u2500`);
    } else if (styleName === 'classic') {
      formattedLines.push(`\u2503\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
      formattedLines.push(`\u2503  \u2726 ${toSmallcaps(cat)} \u2502 ${cmdCount} ${toSmallcaps('cmds')}`);
      formattedLines.push(`\u2503\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
    } else {
      // Modern — enhanced with section number and command count badge
      formattedLines.push(`${borders.line}`);
      formattedLines.push(`${borders.divider}\u2726 [${String(catIndex).padStart(2, '0')}] ${toSmallcaps(cat)} \u2502 ${cmdCount} ${toSmallcaps('commands')}`);
      formattedLines.push(`${borders.line}`);
    }

    const cmds = menuData.categories[cat];
    cmds.forEach((cmd, cmdIdx) => {
      const desc = cmd.description ? ` \u2014 ${toSmallcaps(cmd.description)}` : '';
      const isLastCmd = cmdIdx === cmds.length - 1;
      if (styleName === 'minimal') {
        formattedLines.push(`  ${bulletIcon} ${cmd.name}${desc}`);
        if (!isLastCmd) formattedLines.push('');
      } else if (styleName === 'classic') {
        formattedLines.push(`\u2503 ${bulletIcon} ${cmd.name}${desc}`);
        // Spacer keeps the vertical rule unbroken while giving each command room to breathe
        if (!isLastCmd) formattedLines.push(`\u2503`);
      } else {
        formattedLines.push(`${borders.bulletLine}${bulletIcon} ${cmd.name}${desc}`);
        if (!isLastCmd) formattedLines.push(`${borders.line}`);
      }
    });

    // Add a small gap between categories (except after the last one)
    if (catIndex < sortedCategories.length) {
      formattedLines.push('');
    }
  }

  // ── Footer Ending ────────────────────────────────────────────────────
  formattedLines.push('');
  if (styleName === 'classic') {
    formattedLines.push(`\u2503 ${toSmallcaps('Powered by')} \u2726 {botName} \u2726`);
    formattedLines.push(`\u2517\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
  } else if (styleName === 'minimal') {
    formattedLines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
    formattedLines.push(`${toSmallcaps('Powered by')} \u2726 {botName} \u2726`);
  } else {
    formattedLines.push(`${borders.line}`);
    formattedLines.push(`${borders.bottomLeft}\u2500\u2500 ${toSmallcaps('Powered by')} \u2726 {botName} \u2726 \u2500\u2500`);
  }

  // Apply placeholders and clean anti-spam spacing/broken characters
  return parseText(formattedLines.join('\n'));
};

export default menuTemplate;
