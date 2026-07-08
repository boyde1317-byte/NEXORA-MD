import brand from '../../config/brand.js';

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
    return [
      `╭─「 ${brand.name} 」`,
      `│`,
      `│ Developer:`,
      `│ ${brand.creator}`,
      `│`,
      `│ Framework:`,
      `│ ${brand.core}`,
      `│`,
      `│ Version:`,
      `│ ${brand.version}`,
      `│`,
      `╰─ ${brand.signature}`
    ].join('\n');
  }
};

export const getCreator = () => credits.getCreator();
export const getProject = () => credits.getProject();
export const getVersion = () => credits.getVersion();
export const getSignature = () => credits.getSignature();
export const getFullCredits = () => credits.getFullCredits();

export default credits;
