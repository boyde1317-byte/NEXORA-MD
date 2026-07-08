import { themeManager } from '../ui/themeManager.js';

export default {
  name: 'settheme',
  aliases: ['theme', 'style'],
  category: 'owner',
  description: 'Changes the global active bot design theme (Owner Only).',
  permissions: {
    owner: true
  },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    if (!args[0]) {
      const active = themeManager.getTheme();
      return await m.reply(`⚠️ *Usage:* \`${prefix}settheme <modern|classic|minimal>\`\n\n_Current active theme:_ *${active.toUpperCase()}*`);
    }

    const input = args[0].toLowerCase();
    const updated = themeManager.setTheme(input);

    if (!updated) {
      return await m.reply(`❌ Invalid theme: *"${args[0]}"*.\nAvailable options: \`modern\`, \`classic\`, \`minimal\`.`);
    }

    await m.reply(`✅ *BOT DESIGN THEME UPDATED!*\n\n• *Active Theme:* _${input.toUpperCase()}_\n\n_All system messages and menus will now adapt dynamically._`);
  }
};
