import { greetingConfig } from '../greetings/greetingConfig.js';

export default {
  name: 'welcome',
  aliases: ['wc'],
  category: 'owner',
  description: 'Toggle global welcome messages on or off.',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const opt = args[0] ? args[0].toLowerCase() : null;
    if (!opt || (opt !== 'on' && opt !== 'off')) {
      const current = greetingConfig.getEnabled() ? 'ON' : 'OFF';
      return await m.reply.info(`_Current status:_ *${current}*\n\nEnable welcome alerts with \`${prefix}welcome on\`.`, 'WELCOME CONTROLS');
    }

    const enabled = opt === 'on';
    greetingConfig.setEnabled(enabled);
    await m.reply.success(`Global welcome notification is now *${enabled ? 'ENABLED' : 'DISABLED'}*!`);
  }
};
