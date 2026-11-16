import brand from '../../config/brand.js';
import { toSmallcaps } from '../lib/smallcaps.js';
import { toFancy } from '../lib/fancyFonts.js';

export const credits = {
  getCreator() {
    return brand.creator;
  },

  getProject() {
    return brand.name;
  },

  getVersion() {
    return brand.version;
  },

  getSignature() {
    return brand.signature;
  },

  getFullCredits() {
    // One-box rule: the same slim box every reply frame uses, with the
    // brand mix — styled name, script creator/signature, smallcaps
    // labels, plain version. Wording unchanged from the original card.
    const name = brand.display?.name || brand.name;
    return [
      `╭─「 ${name} 」`,
      `│`,
      `│ ${toSmallcaps('Developer')}:`,
      `│ ${toFancy('script', 'Lord Aizen')}`,
      `│`,
      `│ ${toSmallcaps('Framework')}:`,
      `│ ${name}`,
      `│`,
      `│ ${toSmallcaps('Version')}:`,
      `│ ${brand.version}`,
      `│`,
      `│ ༒ ${toFancy('script', 'Sturdy Loner')} ༒`,
      `╰────────────────────────╯`
    ].join('\n');
  }
};

export const getCreator = () => credits.getCreator();
export const getProject = () => credits.getProject();
export const getVersion = () => credits.getVersion();
export const getSignature = () => credits.getSignature();
export const getFullCredits = () => credits.getFullCredits();

export default credits;
