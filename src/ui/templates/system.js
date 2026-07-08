import { asciiBuilder } from '../asciiBuilder.js';

export const systemTemplate = (systemData) => {
  const lines = [
    `⚡ Speed: ${systemData.speed || '0.3s'}`,
    `📟 Memory: ${systemData.ram || '184MB'}`,
    `⏳ Uptime: ${systemData.uptime || '1h 30m'}`,
    `👥 Users: ${systemData.users || '5'}`
  ];
  return asciiBuilder.box('BOT STATUS', lines);
};

export default systemTemplate;
