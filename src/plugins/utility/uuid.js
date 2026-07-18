import crypto from 'crypto';
import { copyResultCard } from '../../lib/interactiveKit.js';

export default {
  name: 'uuid',
  aliases: ['guid'],
  category: 'developer',
  description: 'Generates a random UUID (v4).',
  cooldown: 2000,
  execute: async ({ m, sock }) => {
    const uuid = crypto.randomUUID();
    
    await copyResultCard(sock, m.from, {
      text: `🆔 *UUID GENERATOR*\n\n*${uuid}*`,
      footer: 'Developer Tools',
      copyLabel: '📋 Copy UUID',
      copyValue: uuid
    }, { quoted: m });
  }
};
