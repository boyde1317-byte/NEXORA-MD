import { themeManager } from './themeManager.js';
import { layoutConfig } from '../../config/layout.js';

export const asciiBuilder = {
  /**
   * Generates a standard styled box.
   * Format:
   * ╭─「 TITLE 」
   * │
   * │ Line 1
   * │ Line 2
   * │
   * ╰───────────────
   */
  box(title, lines = []) {
    const borders = themeManager.getBorders();
    const styleName = themeManager.getTheme();
    const formattedLines = [];

    // Header Title
    if (styleName === 'minimal') {
      formattedLines.push(`── ${title.toUpperCase()} ──`);
    } else if (styleName === 'classic') {
      formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━`);
      formattedLines.push(`┃  ${title.toUpperCase()}`);
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    } else {
      // Modern
      formattedLines.push(`${borders.topLeft}${borders.headerStart}${title.toUpperCase()}${borders.headerEnd}`);
      formattedLines.push(`${borders.line}`);
    }

    // Body Lines
    lines.forEach(line => {
      if (styleName === 'minimal') {
        formattedLines.push(`${line}`);
      } else {
        formattedLines.push(`${borders.line} ${line}`);
      }
    });

    // Empty buffer line for breathing room before footer (except for minimal)
    if (styleName !== 'minimal' && styleName !== 'classic' && lines.length > 0) {
      formattedLines.push(`${borders.line}`);
    }

    // Footer Border
    if (styleName === 'classic') {
      formattedLines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━`);
    } else if (styleName === 'minimal') {
      formattedLines.push(`────────────────────────`);
    } else {
      // Modern
      formattedLines.push(`${borders.bottomLeft}────────────────`);
    }

    return formattedLines.join('\n');
  },

  /**
   * Generates an itemized bulleted list inside a border wrapper.
   * Format:
   * ╭─「 TITLE 」
   * │
   * ├ ◦ Item 1
   * ├ ◦ Item 2
   * │
   * ╰───────────────
   */
  list(title, items = []) {
    const borders = themeManager.getBorders();
    const styleName = themeManager.getTheme();
    const formattedLines = [];
    const bulletIcon = layoutConfig.icons.bullet;

    // Header Title
    if (styleName === 'minimal') {
      formattedLines.push(`── ${title.toUpperCase()} ──`);
    } else if (styleName === 'classic') {
      formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━`);
      formattedLines.push(`┃  ${title.toUpperCase()}`);
      formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);
    } else {
      // Modern
      formattedLines.push(`${borders.topLeft}${borders.headerStart}${title.toUpperCase()}${borders.headerEnd}`);
      formattedLines.push(`${borders.line}`);
    }

    // List Items
    items.forEach(item => {
      if (styleName === 'minimal') {
        formattedLines.push(` ${bulletIcon} ${item}`);
      } else if (styleName === 'classic') {
        formattedLines.push(`┃ ${bulletIcon} ${item}`);
      } else {
        // Modern - use bulletLine (├ )
        formattedLines.push(`${borders.bulletLine}${bulletIcon} ${item}`);
      }
    });

    // Spacer & Footer
    if (styleName === 'classic') {
      formattedLines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━`);
    } else if (styleName === 'minimal') {
      formattedLines.push(`────────────────────────`);
    } else {
      formattedLines.push(`${borders.line}`);
      formattedLines.push(`${borders.bottomLeft}────────────────`);
    }

    return formattedLines.join('\n');
  },

  /**
   * Generates a thick card container.
   * Format:
   * ┏━━━━━━━━━━━━━━
   * ┃  TITLE
   * ┣━━━━━━━━━━━━━━
   * ┃ Key 1: Val 1
   * ┃ Key 2: Val 2
   * ┗━━━━━━━━━━━━━━
   */
  card(title, entries = []) {
    const formattedLines = [];
    formattedLines.push(`┏━━━━━━━━━━━━━━━━━━━━━━━`);
    formattedLines.push(`┃  ${title.toUpperCase()}`);
    formattedLines.push(`┣━━━━━━━━━━━━━━━━━━━━━━━`);

    entries.forEach(entry => {
      formattedLines.push(`┃ ${entry}`);
    });

    formattedLines.push(`┗━━━━━━━━━━━━━━━━━━━━━━━`);
    return formattedLines.join('\n');
  }
};

export default asciiBuilder;
