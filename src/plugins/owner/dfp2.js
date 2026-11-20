/**
 * dfp2.js — owner-only plugin file deleter (second variant).
 *
 *   .dfp2 <category/name.js>   delete a plugin file from src/plugins
 *
 * Ported from the LUNA MD owner-dfp.js plugin. NexoraFlex already ships
 * .dfp (src/plugins/owner/dfp.js), so this variant is .dfp2 and never
 * shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-dfp.js):
 *   - The LUNA `plugins` global (a map of loaded plugin names) does not
 *     exist in NexoraFlex, so the file list for the not-found message
 *     comes from an fs walk of src/plugins instead.
 *   - The target path is resolved and must stay inside src/plugins
 *     (no `..` escapes), matching the guard rails the house dfp.js has.
 *   - String throws are replaced with `m.reply.error` replies; the
 *     `__dirname` the original relied on is computed from import.meta.url.
 *   - `conn.reply(m.chat, ...)` -> `m.reply(...)`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '..');

function listPluginFiles(dir = PLUGINS_DIR, prefix = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listPluginFiles(absolute, relative));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(relative);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export default {
  name: 'dfp2',
  aliases: [],
  category: 'owner',
  description: 'Delete a plugin file. Usage: .dfp2 <category/name.js>. Owner only.',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const rel = (args[0] || '').trim().replace(/^[./\\]+/, '');
    if (!rel) {
      return await m.reply.error(
        `Usage: ${p}dfp2 <category/name.js>\nExample: ${p}dfp2 utility/lockcmd.js`
      );
    }
    if (rel.includes('..')) return await m.reply.error('Refusing a path that climbs out of the plugin tree.');

    const target = path.resolve(PLUGINS_DIR, rel.endsWith('.js') ? rel : `${rel}.js`);
    if (!target.startsWith(PLUGINS_DIR + path.sep)) {
      return await m.reply.error('That path is outside the plugin tree.');
    }
    if (!fs.existsSync(target)) {
      const files = listPluginFiles();
      return await m.reply.error(
        `*🗃️ NOT FOUND!*\n\n${files.map((v) => ` ${v.replace(/\.js$/, '')}`).join('\n')}`
      );
    }
    if (path.basename(target) === 'index.js') return await m.reply.error('Refusing to delete an index file.');

    fs.unlinkSync(target);
    const deleted = path.relative(PLUGINS_DIR, target);
    return await m.reply.success(
      `Deleted "plugins/${deleted}" — run ${p}reload all to unload it`
    );
  },
};
