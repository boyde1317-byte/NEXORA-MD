/**
 * Visual styling and typography formatting helpers for WhatsApp menus.
 */

import { menuTemplate } from '../ui/templates/menu.js';
import { themeManager } from '../ui/themeManager.js';
import { asciiBuilder } from '../ui/asciiBuilder.js';

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning 🌅';
  if (hour < 18) return 'Good Afternoon ☀️';
  return 'Good Evening 🌃';
};

export const divider = '─────────────────────────';
export const fancyDivider = '❃ ───────────────────── ❃';

/**
 * Formats a clean standard listing of all commands, grouped by category using layout modernization
 */
export const buildTextMenu = (menuData) => {
  return menuTemplate(menuData);
};

/**
 * Builds a minimalist, reaction-friendly summary command list using active layout borders
 */
export const buildCompactMenu = (menuData) => {
  const lines = [];
  lines.push(`Greeting: ${getGreeting()}`);
  lines.push(`Commands: ${menuData.totalCommands} | Users: ${menuData.users}`);
  
  const categories = Object.keys(menuData.categories).sort();
  for (const cat of categories) {
    const list = menuData.categories[cat].map(c => c.name).join(', ');
    lines.push(`• ${cat.toUpperCase()}: ${list}`);
  }

  return asciiBuilder.box(menuData.botName || 'COMPACT MENU', lines);
};

export default {
  getGreeting,
  divider,
  fancyDivider,
  buildTextMenu,
  buildCompactMenu
};
