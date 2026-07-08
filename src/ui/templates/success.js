import { asciiBuilder } from '../asciiBuilder.js';

export const successTemplate = (message) => {
  return asciiBuilder.box('SUCCESS', [`✅ ${message}`]);
};

export default successTemplate;
