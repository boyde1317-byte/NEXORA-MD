/**
 * gp2.js — owner-only plugin browser with the full source sent in-chat.
 *
 * Usage:
 *   .gp2              list every plugin file below src/plugins in an Airich table
 *   .gp2 <name>       info card + table, then the FULL source in a second
 *                     message with a copy-to-clipboard button on top
 *
 * Why gp2 and not gp: NexoraFlex already ships src/plugins/owner/gp.js
 * (same command names .gp / .getplugin). That one shows a 2000-char preview
 * and attaches the rest as a document. This one is the LUNA MD variant —
 * the whole file arrives in chat, copyable. Separate name, no shadowing:
 * the loader warns and lets the last registration win on duplicate names.
 *
 * Differences from the LUNA MD original (plugins/gp.js):
 *   - Plugin list comes from an fs walk of src/plugins (same helper shape
 *     as the house gp.js), not a `global.plugins` object — NexoraFlex has
 *     no such global; its registry is client.commands (name -> plugin,
 *     no file paths), which cannot answer "show me the file".
 *   - The `cat plugins/<name>.js` shell call is gone. Files are read with
 *     fs.readFileSync behind the same traversal guard the house gp.js uses
 *     (rejects ".." and absolute paths). That also closes the shell-injection
 *     hole the original had when the plugin name came from chat input.
 *     Owner-only, but there is no reason to keep a shell in the path.
 *   - AIRich comes from the shared lib (../../lib/NIXCODE.js). That class
 *     has no addCodeFull, so this file adds it as a tiny subclass using the
 *     lib's own public addSection()/addCode(): the COPY_TO_CLIPBOARD widget
 *     section is pushed first, then the tokenized code section.
 *   - addSource uses the house signature (array of [image, url, text]).
 *   - `m.chat` -> `m.from`, `conn` -> `sock`, `usedPrefix` -> `prefix`
 *     from the execute context; user-facing strings say NEXORA MD.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIRich } from '../../lib/NIXCODE.js';
import brand from '../../../config/brand.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_ROOT = path.resolve(__dirname, '..');
const MAX_TABLE_ROWS = 50;
const OWNER_NUMBER = '233533416608';
// Fallback avatar for the owner entity card — only used when WhatsApp
// cannot return the owner's profile picture. Carried over from the LUNA
// original (the previous owner's catbox link); swap it for a NEXORA asset
// if it ever shows the wrong face.
const DEV_PP_FALLBACK = 'https://litter.catbox.moe/4evj2u.jpg';

/**
 * Shared AIRich plus the one builder the LUNA original relied on: a code
 * block with the copy button rendered ABOVE the code instead of below it.
 * Built only from the lib's public addSection()/addCode() — no internals.
 */
class AIRichFull extends AIRich {
  addCodeFull(code) {
    // 1 - The copy button comes first so it shows at the top of the content.
    this.addSection({
      view_model: {
        __typename: 'GenAIAddonActionLayoutViewModel',
        addon_action_type: 'COPY_TO_CLIPBOARD',
        addon_action_alignment: 'END',
        primitives: [{
          __typename: 'GenAIMarkdownTextUXPrimitive',
          text: `\`${code}\``,
          inline_entities: [],
        }],
      },
    });
    // 2 - Then the full code after it (tokenized by the shared addCode).
    this.addCode('javascript', code);
    return this;
  }
}

function listPluginFiles(dir = PLUGINS_ROOT, prefix = '') {
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

function pluginPath(name) {
  const clean = String(name || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean || clean.includes('..') || clean.startsWith('/')) return null;
  const relative = clean.endsWith('.js') ? clean : `${clean}.js`;
  const target = path.resolve(PLUGINS_ROOT, relative);
  if (!target.startsWith(`${PLUGINS_ROOT}${path.sep}`) || !fs.existsSync(target)) return null;
  return { target, relative };
}

function tableRows(files) {
  return files.slice(0, MAX_TABLE_ROWS).map((file, index) => {
    const category = file.split('/')[0] || 'root';
    return [String(index + 1), file.replace(/\.js$/, ''), category, 'Active'];
  });
}

export default {
  name: 'gp2',
  aliases: ['getplugin2'],
  category: 'owner',
  description: 'Browse plugins, or send a plugin\u2019s full source in-chat with a copy button (owner only).',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    const command = 'gp2';
    const botName = brand.name || 'NEXORA MD';
    const files = listPluginFiles();
    const requested = args.join('/').trim();

    let devPp = DEV_PP_FALLBACK;
    try { devPp = await sock.profilePictureUrl(`${OWNER_NUMBER}@s.whatsapp.net`, 'image'); } catch (_) {}

    if (!requested) {
      const card = new AIRichFull(sock)
        .setTitle(`PLUGIN LIST - ${files.length} FILES`)
        .setFooter(`${botName} - Developer ${OWNER_NUMBER} - ${files.length} plugins`)
        .addEntity({
          title: `${files.length} Plugins Available`,
          subtitle: `Owner of ${botName}`,
          secondary: `${OWNER_NUMBER} • Verified`,
          id: OWNER_NUMBER,
          imageUrl: devPp,
        })
        .addText(`FULL PLUGIN LIST\nTotal: ${files.length} files\nDeveloper: ${OWNER_NUMBER}\nBot: ${botName}`)
        .addTable([
          ['No', 'Plugin Name', 'Category', 'Access'],
          ...tableRows(files),
        ])
        .addSource([[devPp, 'https://github.com/boyde1317-byte/nexoraflex', `Developer ${OWNER_NUMBER}`]])
        .addSuggest(files.slice(0, 5).map((file) => `${p}${command} ${file.replace(/\.js$/, '')}`))
        .addTip(`Type ${p}${command} plugin_name to view the code - ${botName}`);
      return card.send(m.from, { quoted: m });
    }

    if (!pluginPath(requested)) {
      const card = new AIRichFull(sock)
        .setTitle('NOT FOUND')
        .setFooter(`${botName} - ${OWNER_NUMBER}`)
        .addEntity({
          title: `${requested} - Not Found`,
          subtitle: 'Plugin does not exist',
          secondary: OWNER_NUMBER,
          id: OWNER_NUMBER,
          imageUrl: devPp,
        })
        .addText(`Plugin ${requested} not found\nCheck the list with ${p}${command}`)
        .addTable([
          ['No', 'Plugin Name', 'Status'],
          ...files.slice(0, 30).map((file, i) => [String(i + 1), file.replace(/\.js$/, ''), 'OK']),
        ]);
      return card.send(m.from, { quoted: m });
    }

    try {
      const found = pluginPath(requested);
      const content = fs.readFileSync(found.target, 'utf8').trim();
      const lines = content.split('\n').length;
      const size = content.length;

      // ===== Message 1 - just the info + the table =====
      const rfile = new AIRichFull(sock)
        .setTitle(`PLUGIN: ${found.relative}`)
        .setFooter(`${botName} - ${OWNER_NUMBER} - ${size} chars`)
        .addEntity({
          title: found.relative,
          subtitle: `${size} chars - ${lines} lines`,
          secondary: `Developer ${OWNER_NUMBER}`,
          id: OWNER_NUMBER,
          imageUrl: devPp,
        })
        .addTable([
          ['Info', 'Detail'],
          ['File Name', found.relative],
          ['Size', `${size} chars`],
          ['Lines', `${lines} lines`],
          ['Developer', OWNER_NUMBER],
          ['Bot', botName],
          ['Status', 'Active'],
        ])
        .addText('The full code is sent in the next message with the copy button on top.')
        .addSource([[devPp, 'https://github.com/boyde1317-byte/nexoraflex', `Developer ${OWNER_NUMBER}`]])
        .addSuggest([`${p}${command} ${found.relative.replace(/\.js$/, '')}`]);

      await rfile.send(m.from, { quoted: m });

      // ===== Message 2 - just the full code alone + copy button on top =====
      const rcode = new AIRichFull(sock)
        .setTitle(`CODE: ${found.relative}`)
        .setFooter(`${botName} - ${found.relative} - ${size} chars`)
        .addCodeFull(content); // full - not truncated

      await rcode.send(m.from, { quoted: m });
    } catch (e) {
      await m.reply.error(`Error: ${e.message}`);
    }
  },
};
