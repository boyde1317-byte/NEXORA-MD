export const systemTemplate = (systemData) => {
  return `✦ *SYSTEM STATUS* ✦
⚡ *Uptime:* ${systemData.uptime || '0m'}
💽 *RAM:* ${systemData.ram || '0MB'}
⚙️ *Platform:* ${systemData.platform || 'Node'}
🚀 *Speed:* ${systemData.ping || '0ms'}`;
};

export default systemTemplate;
