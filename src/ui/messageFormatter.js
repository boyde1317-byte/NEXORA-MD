import { successTemplate } from './templates/success.js';
import { errorTemplate } from './templates/error.js';
import { warningTemplate } from './templates/warning.js';
import { infoTemplate } from './templates/info.js';
import { profileTemplate } from './templates/profile.js';
import { systemTemplate } from './templates/system.js';

export const messageFormatter = {
  success(message) {
    return successTemplate(message);
  },

  error(message) {
    return errorTemplate(message);
  },

  warn(message) {
    return warningTemplate(message);
  },

  info(message, title = 'INFO') {
    return infoTemplate(message, title);
  },

  loading(message = 'Downloading media...') {
    return infoTemplate(`⏳ ${message}`, 'PROCESSING');
  },

  profile(profileData) {
    return profileTemplate(profileData);
  },

  system(systemData) {
    return systemTemplate(systemData);
  }
};

export default messageFormatter;
