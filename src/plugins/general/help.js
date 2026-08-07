/**
 * help.js — Per-command detailed help.
 *
 * `.help` shows an interactive category picker (tap a category to explore).
 * `.help <category>` shows all commands in that category.
 * `.help <command>` shows detailed usage for a specific command, including
 * aliases, description, category, cooldown, and permissions.
 *
 * UX: Upgraded from plain text to a selectMenu picker so users can tap
 * categories instead of typing — same pattern as `.menulist`.
 */
import { client } from '../../core/client.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { selectMenu, actionCard } from '../../lib/interactiveKit.js';
import { buildEnrichedContextInfo } from '../../lib/enrichContext.js';

export default {
  name: 'help',
  aliases: ['h', 'cmds', 'commands'],
  category: 'general',
  description: 'Get help. Use .help <command> for detailed info on a specific command.',
  cooldown: 2000,
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';

    // Build category map once
    const categories = {};
    client.commands.forEach((cmd) => {
      // Hidden commands (category: null) don't appear in help listings
      if (!cmd.category) return;
      const cat = cmd.category;
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.name);
    });

    // ── No args: show interactive category picker ────────────────────
    if (!args[0]) {
      const sortedCats = Object.keys(categories).sort();
      const totalCmds = sortedCats.reduce((sum, cat) => sum + categories[cat].length, 0);

      const headerText = [
        `✦ *${toSmallcaps('Command Guide')}* ✦`,
        ``,
        `${totalCmds} commands across ${sortedCats.length} categories. Pick your poison. ☕`,
        ``,
        `${toSmallcaps('Tap a category below to explore its commands')}:`,
      ].join('\n');

      const footerText = `${toSmallcaps('NEXORA-MD')} • ${toSmallcaps('Help Picker')}`;

      // Build selectMenu sections — one per category, sorted
      const sections = sortedCats.map(cat => ({
        title: `${toSmallcaps(cat)} (${categories[cat].length})`,
        rows: categories[cat].sort().map(c => ({
          id:          `${p}help ${c}`,
          title:       `${p}${c}`,
          description: client.commands.get(c)?.description?.slice(0, 60) || toSmallcaps('No description'),
        })),
      }));

      try {
        return await selectMenu(sock, m.from, {
          text:   headerText,
          footer: footerText,
        }, `📖 ${toSmallcaps('Choose Category')}`, sections, [
          { kind: 'action', label: `🎮 Open Menu`,     cmd: `${p}menu` },
          { kind: 'action', label: `🏓 Ping Bot`,      cmd: `${p}ping` },
        ], { quoted: m });
      } catch (err) {
        console.warn('[help] Interactive selectMenu failed, falling back to text:', err.message);
      }

      // ── Fallback: plain text category summary ───────────────────────
      const lines = [
        `${totalCmds} commands across ${sortedCats.length} categories.\n`,
      ];

      for (const cat of sortedCats) {
        lines.push(`• *${toSmallcaps(cat)}* — ${categories[cat].length} cmds`);
      }

      lines.push('');
      lines.push(`_Type \`${p}help <category>\` to list commands in that category._`);
      lines.push(`_Type \`${p}help <command>\` for detailed usage._`);
      lines.push(`_Type \`${p}menu\` for the interactive menu._`);

      return await m.reply(asciiBuilder.box('Command Guide', lines), { contextInfo: buildEnrichedContextInfo() });
    }

    // ── Category listing: .help <category> ──────────────────────────────
    const query = args[0].toLowerCase();
    if (categories[query]) {
      const cmds = categories[query].sort();
      const lines = [
        `*${toSmallcaps(query)}* — ${cmds.length} command${cmds.length !== 1 ? 's' : ''}\n`,
        ...cmds.map(c => `  ${p}${c}`),
        `\n_Use \`${p}help <command>\` for detailed usage._`,
      ];

      // Add interactive buttons for the first few commands in the category
      try {
        await m.reply(asciiBuilder.box(`${query} Commands`, lines), { contextInfo: buildEnrichedContextInfo() });
        const quickButtons = cmds.slice(0, 4).map(c => ({
          label: `▶️ ${p}${c}`,
          cmd:   `${p}help ${c}`,
        }));
        if (quickButtons.length > 0) {
          await actionCard(sock, m.from, {
            text:   `${toSmallcaps('Tap a command for detailed usage')}:`,
            footer: `${toSmallcaps(query)} • ${cmds.length} commands`,
          }, quickButtons, { quoted: m });
        }
      } catch (_) {
        await m.reply(asciiBuilder.box(`${query} Commands`, lines), { contextInfo: buildEnrichedContextInfo() });
      }
      return;
    }

    // ── Specific command help: .help <command> ──────────────────────────
    const resolvedName = client.aliases.get(query) || query;
    const command = client.commands.get(resolvedName);

    if (!command) {
      // Try fuzzy match
      const allNames = [...client.commands.keys(), ...client.aliases.keys()];
      const { suggestCommand } = await import('../../lib/fuzzyMatch.js');
      const suggestion = suggestCommand(query, allNames);
      const hint = suggestion ? `\n\nDid you mean: *${p}${suggestion}*?` : '';
      return await m.reply.error(`Command not found: *${p}${query}*${hint}`);
    }

    const perms = command.permissions || {};
    const lines = [
      `*${toSmallcaps('Command')}:* ${p}${command.name}`,
    ];

    if (command.aliases?.length) {
      lines.push(`*${toSmallcaps('Aliases')}:* ${command.aliases.map(a => `${p}${a}`).join(', ')}`);
    }

    lines.push(`*${toSmallcaps('Category')}:* ${toSmallcaps(command.category || 'general')}`);

    if (command.description) {
      lines.push(`*${toSmallcaps('Description')}:* ${command.description}`);
    }

    if (command.cooldown) {
      lines.push(`*${toSmallcaps('Cooldown')}:* ${(command.cooldown / 1000).toFixed(1)}s`);
    }

    // Permission flags
    const permFlags = [];
    if (perms.owner ?? command.ownerOnly) permFlags.push(toSmallcaps('Owner Only'));
    if (perms.groupOnly ?? command.groupOnly) permFlags.push(toSmallcaps('Group Only'));
    if (perms.admin ?? command.adminOnly) permFlags.push(toSmallcaps('Admin Only'));
    if (perms.botAdmin ?? command.botAdmin) permFlags.push(toSmallcaps('Bot Admin Required'));
    if (permFlags.length) {
      lines.push(`*${toSmallcaps('Permissions')}:* ${permFlags.join(', ')}`);
    }

    lines.push('');
    lines.push(`_Type \`${p}${command.name}\` to use this command. Go on, I dare you. ✦_`);

    await m.reply(asciiBuilder.box(command.name, lines), { contextInfo: buildEnrichedContextInfo() });
  }
};
