import { greetingConfig } from '../greetings/greetingConfig.js';

export default {
  name: 'goodbye',
  aliases: ['gb'],
  category: 'owner',
  description: 'Toggle global goodbye messages on or off.',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const opt = args[0] ? args[0].toLowerCase() : null;
    if (!opt || (opt !== 'on' && opt !== 'off')) {
      const current = greetingConfig.getGoodbyeEnabled() ? 'ON' : 'OFF';
      return await m.reply.info(`_Current status:_ *${current}*\n\nEnable goodbye alerts with \`${prefix}goodbye on\`.`, 'GOODBYE CONTROLS');
    }

    const enabled = opt === 'on';
    greetingConfig.setGoodbyeEnabled(enabled);
    await m.reply.success(`Global goodbye notification is now *${enabled ? 'ENABLED' : 'DISABLED'}*!`);
  }
};
