import { themeManager } from './themeManager.js';
import { asciiBuilder } from './asciiBuilder.js';
import { layoutConfig } from '../../config/layout.js';

export const layoutManager = {
  getTheme() {
    return themeManager.getTheme();
  },

  getBorders() {
    return themeManager.getBorders();
  },

  setTheme(styleName) {
    return themeManager.setTheme(styleName);
  },

  createBox(title, lines) {
    return asciiBuilder.box(title, lines);
  },

  createList(title, items) {
    return asciiBuilder.list(title, items);
  },

  createCard(title, entries) {
    return asciiBuilder.card(title, entries);
  }
};

export default layoutManager;
