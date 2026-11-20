/**
 * reload.js — Hot-reload plugins without restarting the bot.
 *
 * Owner-only command that reloads a single plugin, a category, or all plugins.
 * Uses the upgraded client lifecycle system to properly unload/load plugins.
 *
 * Usage:
 *   .reload <plugin>     — reload a single plugin by name
 *   .reload <category>   — reload all plugins in a category
 *   .reload all          — reload every plugin
 *   .reload              — show usage
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { client } from '../../core/client.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';
import { toSmallcaps } from '../../lib/smallcaps.js';

const PLUGINS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findPluginFile(target) {
  const requested = target.replace(/\\/g, '/').replace(/^\/+|\.js$/gi, '');
  const direct = path.resolve(PLUGINS_DIR, `${requested}.js`);
  if (direct.startsWith(`${PLUGINS_DIR}${path.sep}`) && fs.existsSync(direct)) return direct;

  const wanted = `${path.basename(requested)}.js`;
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(candidate);
      else if (entry.isFile() && entry.name.toLowerCase() === wanted.toLowerCase()) found.push(candidate);
    }
  };
  walk(PLUGINS_DIR);
  return found.length === 1 ? found[0] : null;
}

export default {
  name: 'reload',
  aliases: ['rl', 'hotreload'],
  category: 'owner',
  description: 'Hot-reload plugins without restarting the bot. Usage: .reload <plugin|category|all>',
  cooldown: 2000,
  permissions: { owner: true },
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';

    if (!args[0]) {
      return await m.reply(
        asciiBuilder.box('Plugin Reload', [
          `Usage:`,
          `  \`${p}reload <plugin>\`  — reload a single plugin`,
          `  \`${p}reload <category>\` — reload a category`,
          `  \`${p}reload all\`      — reload everything`,
          ``,
          `Available categories:`,
          ...['ai', 'anime', 'download', 'economy', 'fun', 'games', 'general', 'group', 'media', 'owner', 'utility', 'web']
            .map(c => `  • ${c} (${client.commandsCount?.() || client.commands.size} commands)`),
        ])
      );
    }

    const target = args[0].toLowerCase();

    try {
      if (target === 'all') {
        const before = client.commands.size;
        await client.loadPlugins();
        const after = client.commands.size;
        return await m.reply.success(
          `Reloaded all plugins — ${after} commands loaded (was ${before}).`
        );
      }

      // Try single plugin first
      if (client.commands.has(target)) {
        const result = await client.reloadPlugin(target);
        if (result) {
          return await m.reply.success(`Plugin \`${target}\` reloaded successfully.`);
        }
        return await m.reply.error(`Failed to reload plugin \`${target}\`.`);
      }

      // Try as alias
      const resolved = client.aliases.get(target);
      if (resolved && client.commands.has(resolved)) {
        const result = await client.reloadPlugin(resolved);
        if (result) {
          return await m.reply.success(`Plugin \`${resolved}\` (alias \`${target}\`) reloaded successfully.`);
        }
        return await m.reply.error(`Failed to reload plugin \`${resolved}\`.`);
      }

      // Try as category
      const categoryPlugins = [];
      client.commands.forEach((cmd, name) => {
        if (cmd.category === target) categoryPlugins.push(name);
      });

      if (categoryPlugins.length > 0) {
        const results = { success: 0, fail: 0 };
        for (const name of categoryPlugins) {
          try {
            const r = await client.reloadPlugin(name);
            if (r) results.success++;
            else results.fail++;
          } catch {
            results.fail++;
          }
        }
        return await m.reply.success(
          `Reloaded category \`${toSmallcaps(target)}\` — ${results.success}/${categoryPlugins.length} succeeded${results.fail > 0 ? `, ${results.fail} failed` : ''}.`
        );
      }

      // .sfp can create a plugin after startup. Discover that file and run a
      // full loader pass so `.reload pong` works even before `pong` exists in
      // the command/alias registry. A relative path such as
      // `.reload owner/pong.js` is accepted too.
      const savedFile = findPluginFile(target);
      if (savedFile) {
        await client.loadPlugins();
        const relativeFile = path.relative(PLUGINS_DIR, savedFile);
        const loaded = [...(client._loadedPlugins || [])]
          .find(([, record]) => path.resolve(record.filePath) === path.resolve(savedFile));
        if (loaded) {
          return await m.reply.success(`Loaded saved plugin \`${relativeFile}\` as \`${loaded[0]}\`.`);
        }
      }

      return await m.reply.error(
        `No plugin, alias, or category named \`${target}\` found.\nUse \`${p}reload\` to see available options.`
      );
    } catch (err) {
      return await m.reply.error(`Reload failed: ${err.message}`);
    }
  },
};
