import brand from '../../config/brand.js';

export default {
  name: 'version',
  aliases: ['v', 'ver'],
  category: 'general',
  description: 'Displays current bot, developer, core, and runtime version details.',
  cooldown: 2000,
  execute: async ({ m }) => {
    const text = [
      `╭─「 VERSION 」`,
      `│`,
      `│ Bot:`,
      `│ ${brand.name}`,
      `│`,
      `│ Developer:`,
      `│ ${brand.creator}`,
      `│`,
      `│ Core:`,
      `│ v${brand.version}`,
      `│`,
      `│ Runtime:`,
      `│ Node.js`,
      `│`,
      `╰────────────`
    ].join('\n');

    await m.reply(text);
  }
};
