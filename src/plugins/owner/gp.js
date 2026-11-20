/**
 * gp.js — Rem-compatible plugin browser and source viewer.
 *
 * Usage:
 *   .gp              list available plugins in an Airich table
 *   .gp <name>       show metadata and a syntax-highlighted source preview
 *
 * The full source is returned as a document when it exceeds the rich-card
 * preview limit. Only files below src/plugins are exposed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIRich } from '../../lib/NIXCODE.js';
import brand from '../../../config/brand.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_ROOT = path.resolve(__dirname, '..');
const MAX_PREVIEW = 2000;
const MAX_TABLE_ROWS = 50;

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

function createBaseCard(sock, title, footer) {
  return new AIRich(sock)
    .setTitle(title)
    .setFooter(footer);
}

function addBrandSections(card, files, prefix, command) {
  const image = ASSET_URLS.thumbnail;
  if (image) card.addImage(image);
  card
    .addEntity({
      title: `${files.length} Plugins Available`,
      subtitle: brand.name || 'NEXORA MD',
      secondary: `${brand.display?.creator || brand.creator || 'NEXORA'} • Verified`,
      id: 'nexora',
      imageUrl: image,
    })
    .addText(`# Plugin Directory\n> Total: ${files.length} files\n> Use ${prefix}${command} <plugin> to inspect one file.`)
    .addTable([
      ['#', 'Plugin', 'Category', 'Status'],
      ...tableRows(files),
    ])
    .addSource([[
      image || '',
      'https://github.com/boyde1317-byte/nexoraflex',
      'NexoraFlex source',
    ]])
    .addSuggest(files.slice(0, 5).map((file) => `${prefix}${command} ${file.replace(/\.js$/, '')}`))
    .addTip(`Use ${prefix}${command} <plugin> to view source.`);
  return card;
}

export default {
  name: 'gp',
  aliases: ['getplugin', 'plugininfo'],
  category: 'owner',
  description: 'Browse plugins or inspect a plugin source file with an Airich card.',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ sock, m, args, prefix }) => {
    const p = prefix || '.';
    const command = 'gp';
    const files = listPluginFiles();
    const requested = args.join('/').trim();

    if (!requested) {
      const card = addBrandSections(
        createBaseCard(sock, `PLUGIN DIRECTORY • ${files.length} FILES`, `© ${brand.name || 'NEXORA MD'} • ${files.length} plugins`),
        files,
        p,
        command,
      );
      return card.send(m.from, { quoted: m });
    }

    const found = pluginPath(requested);
    if (!found) {
      const card = createBaseCard(sock, 'PLUGIN NOT FOUND', `© ${brand.name || 'NEXORA MD'}`)
        .addText(`❌ Plugin **${requested}** was not found below src/plugins.`)
        .addTable([
          ['#', 'Plugin', 'Status'],
          ...tableRows(files.slice(0, 30)).map(([n, file]) => [n, file, 'Available']),
        ])
        .addSuggest(files.slice(0, 5).map((file) => `${p}${command} ${file.replace(/\.js$/, '')}`));
      return card.send(m.from, { quoted: m });
    }

    const source = fs.readFileSync(found.target, 'utf8');
    const lines = source.split('\n').length;
    const bytes = Buffer.byteLength(source, 'utf8');
    const preview = source.slice(0, MAX_PREVIEW);
    const card = createBaseCard(sock, `PLUGIN • ${found.relative}`, `© ${brand.name || 'NEXORA MD'} • ${bytes} bytes`)
      .addEntity({
        title: found.relative,
        subtitle: `${bytes} bytes • ${lines} lines`,
        secondary: 'NexoraFlex owner tools',
        id: 'nexora',
        imageUrl: ASSET_URLS.thumbnail,
      })
      .addTable([
        ['Property', 'Value'],
        ['File', found.relative],
        ['Size', `${bytes} bytes`],
        ['Lines', String(lines)],
        ['Status', 'Active'],
      ])
      .addCode('javascript', `${preview}${source.length > MAX_PREVIEW ? '\n// … preview truncated; full source attached below' : ''}`)
      .addSource([[
        ASSET_URLS.thumbnail || '',
        'https://github.com/boyde1317-byte/nexoraflex',
        'NexoraFlex source',
      ]])
      .addSuggest([`${p}${command} ${found.relative.replace(/\.js$/, '')}`]);

    await card.send(m.from, { quoted: m });
    if (source.length > MAX_PREVIEW) {
      await sock.sendMessage(m.from, {
        document: Buffer.from(source),
        mimetype: 'text/javascript',
        fileName: path.basename(found.target),
        caption: `Full source: ${found.relative} (${bytes} bytes)`,
      }, { quoted: m });
    }
  },
};
