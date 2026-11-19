/**
 * sfp.js — save a plugin straight from a chat message.
 *
 * Port of Rem Bot's `.sfp` (YONO DEV): reply to a message holding plugin code
 * with `.sfp <category>/<name>.js` and the code is written into src/plugins.
 *
 * Differences from upstream, all deliberate:
 *  - the code is syntax-checked with `node --check` on a temp .mjs before it is
 *    written, so a paste that WhatsApp mangled never reaches the tree;
 *  - the target must stay inside src/plugins (no ../ escapes);
 *  - an existing file is only replaced with `--force`, so a stray reply cannot
 *    silently clobber a working plugin;
 *  - it does not hot-reload by itself; it points at `.reload <name>`.
 *
 * Usage:
 *   .sfp media/gallery.js            (replying to the code)
 *   .sfp media/gallery.js --force    (replace an existing plugin)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '..');

const MAX_SOURCE = 512 * 1024;

/** Normalises the replied text: strips fences WhatsApp leaves behind. */
export function extractSource(quoted) {
  const raw =
    quoted?.text ||
    quoted?.message?.conversation ||
    quoted?.message?.extendedTextMessage?.text ||
    quoted?.message?.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    '';
  return String(raw)
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/** True when the source parses as an ES module. */
export function validatePluginSource(source, name = 'plugin') {
  if (!source || source.length < 20) return { ok: false, reason: 'no code to save' };
  if (source.length > MAX_SOURCE) return { ok: false, reason: 'source is over 512 KB' };
  if (!/export\s+default/.test(source)) {
    return { ok: false, reason: 'a plugin needs `export default { ... }`' };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-sfp-'));
  const tmp = path.join(dir, `${name.replace(/[^\w.-]/g, '_')}.mjs`);
  try {
    fs.writeFileSync(tmp, source);
    const check = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (check.status !== 0) {
      const detail = (check.stderr || '').split('\n').filter(Boolean).slice(0, 4).join('\n');
      return { ok: false, reason: detail || 'syntax error' };
    }
    return { ok: true };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Resolves a relative target inside src/plugins, or null when it escapes. */
export function resolveTarget(relPath) {
  if (!relPath) return null;
  // Refuse traversal outright rather than silently folding it into the tree.
  if (relPath.includes('..')) return null;
  const clean = relPath.replace(/^[./\\]+/, '');
  const withExt = clean.endsWith('.js') ? clean : `${clean}.js`;
  const abs = path.resolve(PLUGINS_DIR, withExt);
  if (!abs.startsWith(PLUGINS_DIR + path.sep)) return null;
  return abs;
}

export default {
  name: 'sfp',
  aliases: ['spf', 'saveplugin'],
  category: 'owner',
  description: 'Saves plugin code from a replied message. Usage: .sfp <category>/<name>.js [--force]',
  cooldown: 2000,
  permissions: { owner: true },
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const flags = args.filter((a) => a.startsWith('--'));
    const positional = args.filter((a) => !a.startsWith('--'));
    const force = flags.includes('--force');

    if (!positional[0]) {
      return await m.reply(
        `Usage: ${p}sfp <category>/<name>.js [--force]\n` +
          `Reply to the message holding the code.\n\n` +
          `Example: ${p}sfp media/gallery.js\n` +
          `Note: a plugin must start with \`export default { name, execute }\`.`
      );
    }

    const target = resolveTarget(positional[0]);
    if (!target) return await m.reply('That path escapes src/plugins. Give a relative path like media/gallery.js.');

    const source = extractSource(m.quoted);
    if (!source) return await m.reply('Reply to the message that holds the code.');

    const verdict = validatePluginSource(source, path.basename(target));
    if (!verdict.ok) {
      return await m.reply(`Rejected, nothing written.\n\n${verdict.reason}`);
    }

    if (fs.existsSync(target) && !force) {
      return await m.reply(
        `${path.relative(PLUGINS_DIR, target)} already exists. Re-send with --force to replace it.`
      );
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source.endsWith('\n') ? source : `${source}\n`);

    const rel = path.relative(PLUGINS_DIR, target);
    const lines = source.split('\n').length;
    const pluginName = path.basename(target, '.js');
    return await m.reply(
      `Saved ${rel} (${lines} lines, ${(source.length / 1024).toFixed(1)} KB).\n\n` +
        `Apply it with ${p}reload ${pluginName}\n` +
        `It will be lost on the next deploy unless it is committed.`
    );
  },
};
