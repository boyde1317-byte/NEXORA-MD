import { asciiBuilder } from '../asciiBuilder.js';

export const errorTemplate = (message) => {
  const lines = typeof message === 'string' 
    ? message.split('\n').map(l => `❌ ${l}`)
    : ['❌ Something went wrong.', 'Please try again later.'];
    
  return asciiBuilder.box('ERROR', lines);
};

export default errorTemplate;
