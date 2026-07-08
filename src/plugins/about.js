import brand from '../../config/brand.js';
import client from '../core/client.js';
import os from 'os';

export default {
  name: 'about',
  aliases: ['info', 'credits'],
  category: 'general',
  description: 'Displays branding, framework credits, and system info for NEXORA MD.',
  cooldown: 3000,
  execute: async ({ m }) => {
    const totalCmds = client.commands.size;
    const uptimeSec = process.uptime();
    const hrs = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);
    const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const text = [
      `╭─「 ${brand.name} 」`,
      `│`,
      `│ Next Generation`,
      `│ WhatsApp MD Framework`,
      `│`,
      `├─ Developer`,
      `│  ${brand.creator}`,
      `│`,
      `├─ System`,
      `│  Engine:`,
      `│  ${brand.core}`,
      `│  Version: ${brand.version}`,
      `│  Runtime: Node.js ${process.version}`,
      `│  Commands: ${totalCmds} loaded`,
      `│  RAM: ${ram} MB`,
      `│  Uptime: ${hrs}h ${mins}m ${secs}s`,
      `│`,
      `╰─ ${brand.signature}`
    ].join('\n');

    await m.reply(text);
  }
};
