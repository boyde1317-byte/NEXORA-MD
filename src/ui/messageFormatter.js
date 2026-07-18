import { profileTemplate } from './templates/profile.js';
import { systemTemplate } from './templates/system.js';
import { getRandomResponse } from '../nexora-messages.js';

export const messageFormatter = {
  success(message) {
    if (!message) return getRandomResponse('success');
    const msgTrimmed = message.trim();
    if (msgTrimmed === 'Done.' || msgTrimmed === 'Success.' || msgTrimmed === 'Command executed.') {
      return getRandomResponse('success');
    }
    return `✦ ${message}`;
  },
  
  error(message) {
    if (!message) return getRandomResponse('error');
    const msgTrimmed = message.trim();
    if (msgTrimmed === 'Error.' || msgTrimmed === 'Failed.') {
      return getRandomResponse('error');
    }
    const cleanMsg = message.replace(/^(❌ Error: |❌ |Error: )/i, '');
    return `⨯ I ran into an issue: ${cleanMsg}`;
  },
  
  warn(message) {
    if (!message) return getRandomResponse('warning');
    return `⚆ Just a heads up: ${message}`;
  },
  
  info(message, title = '') {
    const formattedTitle = title && title !== 'INFO' && title !== 'PROCESSING' 
      ? `*${title}*\n` 
      : '';
    return `☕ ${formattedTitle}${message}`;
  },
  
  loading(message = 'Processing...') {
    if (message === 'Downloading media...' || message === 'Processing...') {
      return getRandomResponse('loading');
    }
    return `∘ ${message}`;
  },
  
  profile(profileData) {
    return profileTemplate(profileData);
  },
  
  system(systemData) {
    return systemTemplate(systemData);
  }
};

export default messageFormatter;
