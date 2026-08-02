/**
 * help.js — Per-command detailed help.
 *
 * `.help` shows a brief overview of all categories.
 * `.help <command>` shows detailed usage for a specific command, including
 * aliases, description, category, cooldown, and permissions.
 */
import { client } from '../../core/client.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { getRandomResponse } from '../../nexora-messages.js';

export default {
  name: 'help',
  aliases: ['h', 'cmds', 'commands'],
  category: 'general',
  description: 'Get help. Use .help <command> for detailed info on a specific command.',
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';

    // ── No args: show category overview ──────────────────────────────────
    if (!args[0]) {
      const categories = {};
      client.commands.forEach((cmd) => {
        const cat = (cmd.category || 'general');
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.name);
      });

      const lines = [
        `Here's what I can do. Use \`${p}help <command>\` for details on any command.\n`,
      ];

      for (const cat of Object.keys(categories).sort()) {
        const cmds = categories[cat].sort();
        lines.push(`*${cat.toUpperCase()}* (${cmds.length})`);
        lines.push(`  ${cmds.join(', ')}`);
        lines.push('');
      }

      lines.push(`_Type \`${p}menu\` for the interactive command console._`);

      return await m.reply(asciiBuilder.box('📖 COMMAND GUIDE', lines));
    }

    // ── Specific command help ─────────────────────────────────────────────
    const query = args[0].toLowerCase();
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
      `*Command:* ${p}${command.name}`,
    ];

    if (command.aliases?.length) {
      lines.push(`*Aliases:* ${command.aliases.map(a => `${p}${a}`).join(', ')}`);
    }

    lines.push(`*Category:* ${command.category || 'general'}`);

    if (command.description) {
      lines.push(`*Description:* ${command.description}`);
    }

    if (command.cooldown) {
      lines.push(`*Cooldown:* ${(command.cooldown / 1000).toFixed(1)}s`);
    }

    // Permission flags
    const permFlags = [];
    if (perms.owner ?? command.ownerOnly) permFlags.push('Owner Only');
    if (perms.groupOnly ?? command.groupOnly) permFlags.push('Group Only');
    if (perms.admin ?? command.adminOnly) permFlags.push('Admin Only');
    if (perms.botAdmin ?? command.botAdmin) permFlags.push('Bot Admin Required');
    if (permFlags.length) {
      lines.push(`*Permissions:* ${permFlags.join(', ')}`);
    }

    lines.push('');
    lines.push(`_Type \`${p}${command.name}\` to use this command._`);

    await m.reply(asciiBuilder.box(`📖 ${command.name.toUpperCase()}`, lines));
  },
};
