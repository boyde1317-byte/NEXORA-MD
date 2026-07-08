import { themeManager } from '../themeManager.js';
import { layoutConfig } from '../../../config/layout.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';

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
    formattedLines.push(` Owner: {owner}`);
    formattedLines.push(` Version: {version}`);
    formattedLines.push(` Runtime: {runtime}`);
    formattedLines.push(` Prefix: {prefix}`);
  } else if (styleName === 'classic') {
    formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃  {botName}`);
    formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃ Owner: {owner}`);
    formattedLines.push(`┃ Version: {version}`);
    formattedLines.push(`┃ Runtime: {runtime}`);
    formattedLines.push(`┃ Prefix: {prefix}`);
  } else {
    // Modern
    formattedLines.push(`${borders.topLeft}${borders.headerStart}{botName}${borders.headerEnd}`);
    formattedLines.push(`${borders.line}`);
    formattedLines.push(`${borders.line} Owner: {owner}`);
    formattedLines.push(`${borders.line} Version: {version}`);
    formattedLines.push(`${borders.line} Runtime: {runtime}`);
    formattedLines.push(`${borders.line} Prefix: {prefix}`);
  }

  // Iterate categories and format command lists
  const sortedCategories = Object.keys(menuData.categories).sort();
  for (const cat of sortedCategories) {
    if (styleName === 'minimal') {
      formattedLines.push(`\n── ${cat.toUpperCase()} ──`);
    } else if (styleName === 'classic') {
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
      formattedLines.push(`┃  ${cat.toUpperCase()}`);
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    } else {
      // Modern
      formattedLines.push(`${borders.line}`);
      formattedLines.push(`${borders.divider}${borders.headerStart}${cat.toUpperCase()}${borders.headerEnd}`);
      formattedLines.push(`${borders.line}`);
    }

    const cmds = menuData.categories[cat];
    for (const cmd of cmds) {
      if (styleName === 'minimal') {
        formattedLines.push(`  ${bulletIcon} ${cmd.name}`);
      } else if (styleName === 'classic') {
        formattedLines.push(`┃ ${bulletIcon} ${cmd.name}`);
      } else {
        // Modern (use bulletLine: ├ )
        formattedLines.push(`${borders.bulletLine}${bulletIcon} ${cmd.name}`);
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
