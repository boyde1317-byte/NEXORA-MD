/**
 * mainmenu.js — .mainmenu [category] — plain-text command list.
 *
 * Ported from the LUNA MD main-menu plugin (luna-md/plugins/main-menu.js)
 * as its own standalone plugin — NOT a NexoraFlex menu type, and it does
 * not touch the .menu style switcher. The LUNA original was a heavy
 * interactive surface: a native-flow document card with a category
 * picker, a channel button, a webview button, and a quoted orderMessage
 * carrying a hardcoded seller JID and order id. None of that is carried
 * over — no channel link, no hardcoded seller/order ids, no fake quoted
 * order. What survives is the shape: a user/bot info header, then the
 * commands grouped by category.
 *
 * Command data comes from the house commandDirectory index
 * (client.commands), not a global.plugins object. Categories are the
 * NexoraFlex ones; `.mainmenu <category>` narrows to one category.
 * `.menu` / `.help` remain the interactive menu and drill-down.
 */
import brand from '../../../config/brand.js';
import { getDisplayName } from '../../lib/displayName.js';
import { buildCategoryIndex, matchCategory, titleize } from '../../lib/commandDirectory.js';

const MAX_PER_CATEGORY = 20;

export default {
  name: 'mainmenu',
  aliases: ['mainhelp'],
  category: 'general',
  description: 'Plain-text list of all commands grouped by category. Usage: .mainmenu [category]',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix, db, isOwner }) => {
    const p = prefix || '.';
    const byCat = buildCategoryIndex();
    if (!byCat.size) {
      return m.reply('No commands are loaded right now.');
    }

    const user = db.getUser(m.sender);
    const name = await getDisplayName(sock, m.sender);
    const status = m.sender.split('@')[0] === '233533416608'
      ? 'Developer'
      : isOwner ? 'Owner' : user.premium ? 'Premium User' : 'User';
    const botName = brand.name || 'NEXORA MD';
    const version = brand.version || '';

    const header =
      `──────────────────\n\n` +
      `*U S E R*\n` +
      `- \`Name:\` ${name}\n` +
      `- \`Status:\` ${status}\n` +
      `- \`Level:\` ${user.level || 0} • \`XP:\` ${(user.xp || 0).toLocaleString()} • \`Coins:\` ${(user.coins || 0).toLocaleString()}\n\n` +
      `──────────────────\n\n` +
      `*I N F O R M A T I O N*\n` +
      `- \`Bot Name:\` ${botName}\n` +
      `- \`Developer:\` Moonson\n` +
      (version ? `- \`Version:\` ${version}\n` : '') +
      `- \`Prefix:\` ${p}\n\n` +
      `──────────────────`;

    const token = (args[0] || '').toLowerCase();
    const singleCat = token ? matchCategory(token, byCat) : null;
    if (token && !singleCat) {
      const cats = [...byCat.keys()].join(', ');
      return m.reply(`${header}\n\nUnknown category: *${token}*\n\nAvailable: ${cats}\n\nUsage: ${p}mainmenu [category]`);
    }

    const catsToShow = singleCat ? [[singleCat, byCat.get(singleCat)]] : [...byCat.entries()];
    const sections = catsToShow.map(([cat, cmds]) => {
      const names = cmds.map((c) => c.name);
      const shown = names.slice(0, MAX_PER_CATEGORY);
      const extra = names.length - shown.length;
      return (
        `*ᗢ ${titleize(cat)}* (${names.length})\n` +
        shown.map((n) => `- ${p}${n}`).join('\n') +
        (extra > 0 ? `\n...and ${extra} more — ${p}help ${cat}` : '')
      );
    });

    await m.reply(
      `${header}\n\n${sections.join('\n\n')}\n\n──────────────────\n` +
      `*Total:* ${[...byCat.values()].reduce((s, c) => s + c.length, 0)} commands • ` +
      `Type ${p}help <command> for details`
    );
  },
};
