import { themeManager } from '../ui/themeManager.js';

export default {
  name: 'createtheme',
  category: 'owner',
  description: 'Create and register a custom border theme (Owner Only).',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    if (args.length < 5) {
      return await m.reply(`⚠️ *Usage:* \`${prefix}createtheme <theme_name> <topLeft> <line> <bottomLeft> <divider>\`\n\n_Example:_ \`${prefix}createtheme neon ╔ ║ ╚ ╠\``);
    }

    const name = args[0].toLowerCase();
    const topLeft = args[1];
    const line = args[2];
    const bottomLeft = args[3];
    const divider = args[4];

    const customTheme = {
      topLeft: topLeft,
      headerStart: '「 ',
      headerEnd: ' 」',
      line: line,
      divider: divider,
      bulletLine: `${divider} `,
      bottomLeft: bottomLeft
    };

    themeManager.registerTheme(name, customTheme);

    await m.reply(`✅ *CUSTOM THEME REGISTERED!*\n\n• *Name:* \`${name}\`\n• *Top Left:* \`${topLeft}\`\n• *Line:* \`${line}\`\n• *Bottom Left:* \`${bottomLeft}\`\n• *Divider:* \`${divider}\`\n\n_Type \`${prefix}settheme ${name}\` to apply it immediately!_`);
  }
};
