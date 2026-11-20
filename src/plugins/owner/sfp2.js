/**
 * sfp2.js — owner-only plugin saver (second variant).
 *
 *   .sfp2 <category/name.js>   reply to a message holding plugin code
 *                               and save it into src/plugins
 *
 * Ported from the LUNA MD owner-sfp.js plugin. NexoraFlex already ships
 * .sfp (src/plugins/owner/sfp.js), so this variant is .sfp2 and never
 * shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-sfp.js):
 *   - The LUNA version wrote `./plugins/<text>.js` relative to the
 *     process working directory with no traversal guard. The target is
 *     now resolved against src/plugins and must stay inside it.
 *   - The `syntax-error` package is not installed in NexoraFlex, so the
 *     syntax check runs `node --check` on a temp .mjs copy (the same
 *     technique the house sfp.js uses), so a paste WhatsApp mangled
 *     never reaches the tree — and `import` statements still parse,
 *     which a plain vm.Script check would reject.
 *   - `m.quoted?.text` is read through the NexoraFlex serializer shape,
 *     with ``` fences stripped, as the house sfp.js does.
 *   - String throws are replaced with `m.reply.error` replies; the saved
 *     file is confirmed with its line count, and the owner is pointed at
 *     `.reload <name>` to apply it (matching house sfp.js behaviour).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.resolve(__dirname, '..');

const MAX_SOURCE = 512 * 1024;

/** Normalises the replied text: strips fences WhatsApp leaves behind. */
function extractSource(quoted) {
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

/** Resolves a relative target inside src/plugins, or null when it escapes. */
function resolveTarget(relPath) {
  if (!relPath) return null;
  if (relPath.includes('..')) return null;
  const clean = relPath.replace(/^[./\\]+/, '');
  const withExt = clean.endsWith('.js') ? clean : `${clean}.js`;
  const abs = path.resolve(PLUGINS_DIR, withExt);
  if (!abs.startsWith(PLUGINS_DIR + path.sep)) return null;
  return abs;
}

/** True when the source parses as an ES module (via node --check). */
function validatePluginSource(source, name = 'plugin') {
  if (!source || source.length < 20) return { ok: false, reason: 'no code to save' };
  if (source.length > MAX_SOURCE) return { ok: false, reason: 'source is over 512 KB' };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-sfp2-'));
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

export default {
  name: 'sfp2',
  aliases: [],
  category: 'owner',
  description: 'Save plugin code from a replied message. Usage: .sfp2 <category/name.js>. Owner only.',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, args, prefix }) => {
    const p = prefix || '.';
    const targetArg = (args[0] || '').trim();

    if (!targetArg) {
      return await m.reply(
        `Usage: ${p}sfp2 <category/name.js>\n` +
        `Reply to the message holding the code.\n\n` +
        `Example: ${p}sfp2 utility/mycmd.js`
      );
    }

    const target = resolveTarget(targetArg);
    if (!target) {
      return await m.reply.error('That path escapes src/plugins. Give a relative path like utility/mycmd.js.');
    }

    if (!m.quoted?.text && !m.quoted?.message) {
      return await m.reply.error('Reply to the message that holds the code.');
    }
    const code = extractSource(m.quoted);
    if (!code) return await m.reply.error('Reply to the message that holds the code.');

    const verdict = validatePluginSource(code, path.basename(target));
    if (!verdict.ok) {
      return await m.reply.error(`❌ Syntax Error\n\n${verdict.reason}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, code.endsWith('\n') ? code : `${code}\n`);

    const rel = path.relative(PLUGINS_DIR, target);
    const lines = code.split('\n').length;
    const pluginName = path.basename(target, '.js');
    return await m.reply(
      `✅ Saved ${rel} (${lines} lines, ${(code.length / 1024).toFixed(1)} KB).\n\n` +
      `Apply it with ${p}reload ${pluginName}\n` +
      `It will be lost on the next deploy unless it is committed.`
    );
  },
};
