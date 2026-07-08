import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const client = {
  commands: new Map(),
  aliases: new Map(),
  cooldowns: new Map(),
  socket: null, // Holds the active socket reference

  async loadPlugins() {
    this.commands.clear();
    this.aliases.clear();

    const pluginsDir = path.resolve(__dirname, '../plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    console.log(`\n=== Loading Plugins (${files.length} files found) ===`);

    for (const file of files) {
      try {
        const filePath = path.join(pluginsDir, file);
        const fileUrl = new URL(`file://${filePath}`);
        // Cache bust using timestamp for true Hot Reload support
        const pluginModule = await import(`${fileUrl.href}?t=${Date.now()}`);
        const plugin = pluginModule.default;

        if (!plugin || !plugin.name || !plugin.execute) {
          console.warn(`[WARN] Skipping ${file}: invalid or missing default export (must contain name and execute).`);
          continue;
        }

        const cmdName = plugin.name.toLowerCase();
        this.commands.set(cmdName, plugin);

        if (plugin.aliases && Array.isArray(plugin.aliases)) {
          for (const alias of plugin.aliases) {
            this.aliases.set(alias.toLowerCase(), cmdName);
          }
        }
        console.log(`[OK] Loaded command: ${plugin.name} (${plugin.category || 'general'})`);
      } catch (err) {
        console.error(`[ERROR] Failed to load plugin file ${file}:`, err);
      }
    }
    console.log(`=== Loaded ${this.commands.size} commands, ${this.aliases.size} aliases ===\n`);
  }
};

export default client;
