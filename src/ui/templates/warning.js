import { asciiBuilder } from '../asciiBuilder.js';

export const warningTemplate = (message) => {
  const lines = typeof message === 'string'
    ? message.split('\n').map(l => `⚠️ ${l}`)
    : ['⚠️ Caution requested.'];
    
  return asciiBuilder.box('WARNING', lines);
};

export default warningTemplate;
