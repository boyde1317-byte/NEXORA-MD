import { client } from '../core/client.js';
import { db } from '../database/db.js';
import { config } from '../../config/index.js';
import brand from '../../config/brand.js';
import owner from '../../config/owner.js';

/**
 * Format uptime seconds into human readable duration
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const dDisplay = d > 0 ? `${d}d ` : "";
  const hDisplay = h > 0 ? `${h}h ` : "";
  const mDisplay = m > 0 ? `${m}m ` : "";
  const sDisplay = s > 0 ? `${s}s` : "";
  return dDisplay + hDisplay + mDisplay + sDisplay || "0s";
}

/**
 * Scans the plugin system and database stats to compile a global menu data object
 */
export const collectMenuData = (sock) => {
  const totalCommands = client.commands.size;
  
  // Group commands by category
  const categories = {};
  client.commands.forEach((cmd) => {
    const cat = (cmd.category || 'general').toLowerCase();
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push({
      name: cmd.name,
      aliases: cmd.aliases || [],
      description: cmd.description || 'No description provided',
      permissions: cmd.permissions || {}
    });
  });

  // Sort commands inside each category alphabetically
  Object.keys(categories).forEach(cat => {
    categories[cat].sort((a, b) => a.name.localeCompare(b.name));
  });

  const dbData = db.data;
  const totalUsers = Object.keys(dbData.users || {}).length;
  const totalGroups = Object.keys(dbData.groups || {}).length;
  
  const stats = dbData.stats || {};
  const commandsUsed = stats.commandsUsed || {};

  const uptimeSeconds = process.uptime();

  return {
    botName: brand.name,
    ownerName: owner.ownerName,
    prefix: config.prefix[0] || '!',
    uptime: formatUptime(uptimeSeconds),
    runtime: formatUptime(uptimeSeconds),
    users: Math.max(totalUsers, 1),
    groups: totalGroups,
    totalCommands,
    categories,
    statistics: commandsUsed
  };
};

export default collectMenuData;
