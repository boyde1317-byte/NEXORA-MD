import { asciiBuilder } from '../asciiBuilder.js';

export const infoTemplate = (message, title = 'INFO') => {
  const lines = typeof message === 'string'
    ? message.split('\n')
    : [];
  return asciiBuilder.box(title, lines);
};

export default infoTemplate;
