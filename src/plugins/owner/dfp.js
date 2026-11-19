/**
 * dfp.js — delete a plugin file by name. The counterpart to .sfp.
 *
 * Ported from Rem Bot's owner-dfp.js, with the guard rails it lacked: the path
 * is resolved and must stay inside src/plugins, core categories cannot be
 * removed wholesale, and the reply names the file it deleted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '..');

export default {
  name: 'dfp',
  aliases: ['delplugin'],
  category: 'owner',
  description: 'Delete a plugin file. Usage: .dfp <category/name.js>',
  cooldown: 2000,
  permissions: { owner: true },
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const rel = (args[0] || '').trim().replace(/^[./\\]+/, '');
    if (!rel) return await m.reply.error(`Usage: ${p}dfp <category/name.js>\nExample: ${p}dfp utility/lockcmd.js`);
    if (rel.includes('..')) return await m.reply.error('Refusing a path that climbs out of the plugin tree.');

    const target = path.resolve(PLUGINS_DIR, rel.endsWith('.js') ? rel : `${rel}.js`);
    if (!target.startsWith(PLUGINS_DIR + path.sep)) return await m.reply.error('That path is outside the plugin tree.');
    if (!fs.existsSync(target)) return await m.reply.error(`No such plugin: ${rel}`);
    if (path.basename(target) === 'index.js') return await m.reply.error('Refusing to delete an index file.');

    fs.unlinkSync(target);
    return await m.reply.success(`Deleted ${path.relative(PLUGINS_DIR, target)} — run ${p}reload all to unload it`);
  },
};
