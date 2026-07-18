import { greetingConfig } from '../../greetings/greetingConfig.js';

export default {
  name: 'setwelcome',
  aliases: ['stylewelcome', 'wcstyle'],
  category: 'owner',
  description: 'Set greeting layout style (1 = Image, 2 = Document Card, 3 = Interactive).',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const num = parseInt(args[0], 10);
    if (isNaN(num) || ![1, 2, 3].includes(num)) {
      const current = greetingConfig.getStyle();
      let info = `• *1:* Image Greeting (Default)\n`;
      info += `• *2:* Document Card Greeting\n`;
      info += `• *3:* Interactive Card Greeting\n\n`;
      info += `_Current Style:_ *Style ${current}*`;
      return await m.reply.info(info, 'WELCOME STYLE OPTIONS');
    }

    greetingConfig.setStyle(num);
    const names = {
      1: 'Image Greeting',
      2: 'Document Card Greeting',
      3: 'Interactive Greeting'
    };
    await m.reply.success(`Welcome style successfully configured to *Style ${num}: ${names[num]}*!`);
  }
};
