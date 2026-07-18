import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { walkDirSync } from '../lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const client = {
  commands:  new Map(),
  aliases:   new Map(),
  cooldowns: new Map(),
  socket:    null,

  async loadPlugins() {
    this.commands.clear();
    this.aliases.clear();

    const pluginsDir = path.resolve(__dirname, '../plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const files = walkDirSync(pluginsDir).filter(f => f.endsWith('.js'));
    console.log(`\n=== Loading Plugins (${files.length} files found) ===`);

    const failed = [];

    for (const filePath of files) {
      const file = path.relative(pluginsDir, filePath);
      try {
        const fileUrl  = new URL(`file://${filePath}`);
        // Cache-bust with timestamp for hot-reload support
        const mod    = await import(`${fileUrl.href}?t=${Date.now()}`);
        const plugin = mod.default;

        if (!plugin || typeof plugin !== 'object') {
          const reason = 'No default export found';
          console.warn(`[PLUGIN WARN] Skipping ${file}: ${reason}`);
          failed.push({ file, reason });
          continue;
        }

        if (!plugin.name || typeof plugin.name !== 'string') {
          const reason = 'Missing or invalid "name" field';
          console.warn(`[PLUGIN WARN] Skipping ${file}: ${reason}`);
          failed.push({ file, reason });
          continue;
        }

        if (typeof plugin.execute !== 'function') {
          const reason = 'Missing "execute" function';
          console.warn(`[PLUGIN WARN] Skipping ${file}: ${reason}`);
          failed.push({ file, reason });
          continue;
        }

        const cmdName = plugin.name.toLowerCase();
        this.commands.set(cmdName, plugin);

        if (Array.isArray(plugin.aliases)) {
          for (const alias of plugin.aliases) {
            this.aliases.set(alias.toLowerCase(), cmdName);
          }
        }

        console.log(`[OK] Loaded command: ${plugin.name} (${plugin.category || 'general'})`);
      } catch (err) {
        const reason = err.message || String(err);
        console.error(`[PLUGIN ERROR] Failed to load ${file}: ${reason}`);
        failed.push({ file, reason });
      }
    }

    // ── Startup summary ───────────────────────────────────────────────────
    const loaded = this.commands.size;
    console.log(`\n=== Plugin Load Summary ===`);
    console.log(`  Total found : ${files.length}`);
    console.log(`  Successful  : ${loaded}`);
    console.log(`  Aliases     : ${this.aliases.size}`);
    console.log(`  Failed      : ${failed.length}`);
    if (failed.length > 0) {
      console.warn(`  Failed files:`);
      for (const { file, reason } of failed) {
        console.warn(`    ✗ ${file} — ${reason}`);
      }
    }
    console.log(`===========================\n`);
  }
};

export default client;
