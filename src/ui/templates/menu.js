import { themeManager } from '../themeManager.js';
import { layoutConfig } from '../../../config/layout.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

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

  // Header Box
  if (styleName === 'minimal') {
    formattedLines.push(`── {botName} ──`);
    formattedLines.push(` ${toSmallcaps("Owner")}: {owner}`);
    formattedLines.push(` ${toSmallcaps("Version")}: {version}`);
    formattedLines.push(` ${toSmallcaps("Runtime")}: {runtime}`);
    formattedLines.push(` ${toSmallcaps("Prefix")}: {prefix}`);
  } else if (styleName === 'classic') {
    formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃  {botName}`);
    formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃ ${toSmallcaps("Owner")}: {owner}`);
    formattedLines.push(`┃ ${toSmallcaps("Version")}: {version}`);
    formattedLines.push(`┃ ${toSmallcaps("Runtime")}: {runtime}`);
    formattedLines.push(`┃ ${toSmallcaps("Prefix")}: {prefix}`);
  } else {
    // Modern
    formattedLines.push(`${borders.topLeft}${borders.headerStart}{botName}${borders.headerEnd}`);
    formattedLines.push(`${borders.line}`);
    formattedLines.push(`${borders.line} ${toSmallcaps("Owner")}: {owner}`);
    formattedLines.push(`${borders.line} ${toSmallcaps("Version")}: {version}`);
    formattedLines.push(`${borders.line} ${toSmallcaps("Runtime")}: {runtime}`);
    formattedLines.push(`${borders.line} ${toSmallcaps("Prefix")}: {prefix}`);
  }

  // Iterate categories and format command lists
  const sortedCategories = Object.keys(menuData.categories).sort();
  for (const cat of sortedCategories) {
    if (styleName === 'minimal') {
      formattedLines.push(`\n── ${toSmallcaps(cat)} ──`);
    } else if (styleName === 'classic') {
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
      formattedLines.push(`┃  ${toSmallcaps(cat)}`);
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    } else {
      // Modern
      formattedLines.push(`${borders.line}`);
      formattedLines.push(`${borders.divider}${borders.headerStart}${toSmallcaps(cat)}${borders.headerEnd}`);
      formattedLines.push(`${borders.line}`);
    }

    const cmds = menuData.categories[cat];
    for (const cmd of cmds) {
      const desc = cmd.description ? ` — ${toSmallcaps(cmd.description)}` : '';
      if (styleName === 'minimal') {
        formattedLines.push(`  ${bulletIcon} ${cmd.name}${desc}`);
      } else if (styleName === 'classic') {
        formattedLines.push(`┃ ${bulletIcon} ${cmd.name}${desc}`);
      } else {
        // Modern (use bulletLine: ├ )
        formattedLines.push(`${borders.bulletLine}${bulletIcon} ${cmd.name}${desc}`);
      }
    }
  }

  // Footer Ending
  if (styleName === 'classic') {
    formattedLines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━`);
  } else if (styleName === 'minimal') {
    formattedLines.push(`\n────────────────────────`);
  } else {
    // Modern
    formattedLines.push(`${borders.line}`);
    formattedLines.push(`${borders.bottomLeft}────────────────`);
  }

  // Apply placeholders and clean anti-spam spacing/broken characters
  return parseText(formattedLines.join('\n'));
};

export default menuTemplate;
