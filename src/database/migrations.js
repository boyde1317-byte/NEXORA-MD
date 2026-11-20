/**
 * Database Migration and Schema Validation System for NEXORA-MD
 */

/**
 * Validates top-level database structure against expected schema keys.
 * Logs warnings for missing or unexpected keys.
 *
 * @param {object} data - Database state object
 * @returns {boolean} - True if validation finished
 */
export function validateSchema(data) {
  if (!data || typeof data !== 'object') {
    console.warn('[DB SCHEMA] Invalid database data object provided.');
    return false;
  }

  const expectedKeys = ['users', 'groups', 'settings', 'stats', 'reminders', 'digest'];
  const actualKeys = Object.keys(data);

  // Check missing expected keys
  for (const key of expectedKeys) {
    if (!(key in data)) {
      console.warn(`[DB SCHEMA WARNING] Missing expected top-level key: "${key}"`);
    }
  }

  // Check unexpected top-level keys
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      console.warn(`[DB SCHEMA WARNING] Unexpected top-level key: "${key}"`);
    }
  }

  return true;
}

/**
 * Built-in migrations list.
 * Each migration object contains:
 *   - id: unique numeric identifier
 *   - name: short descriptive name
 *   - up: function(data) performing data mutations
 */
export const migrations = [
  {
    id: 1,
    name: 'addUserFields',
    up(data) {
      if (!data.users) data.users = {};
      for (const jid of Object.keys(data.users)) {
        const user = data.users[jid];
        if (!user || typeof user !== 'object') continue;
        if (user.banned === undefined) user.banned = false;
        if (user.premium === undefined) user.premium = false;
        if (user.warnings === undefined) user.warnings = 0;
        if (user.hasOnboarded === undefined) user.hasOnboarded = false;
        if (user.createdAt === undefined) user.createdAt = Date.now();
        if (user.xp === undefined) user.xp = 0;
        if (user.coins === undefined) user.coins = 0;
        if (user.level === undefined) user.level = 0;
        if (user.streak === undefined) user.streak = 0;
        if (user.lastDaily === undefined) user.lastDaily = null;
      }
    }
  },
  {
    id: 2,
    name: 'addGroupFields',
    up(data) {
      if (!data.groups) data.groups = {};
      for (const jid of Object.keys(data.groups)) {
        const group = data.groups[jid];
        if (!group || typeof group !== 'object') continue;
        if (group.antilink === undefined) group.antilink = false;
        if (group.mute === undefined) group.mute = false;
        if (group.createdAt === undefined) group.createdAt = Date.now();
        if (group.antitag === undefined) group.antitag = false;
        if (group.warnings === undefined) group.warnings = {};
      }
    }
  },
  {
    id: 3,
    name: 'addSettingsDefaults',
    up(data) {
      if (!data.settings) data.settings = {};
      if (data.settings.menuStyle === undefined) data.settings.menuStyle = 1;
      if (data.settings.theme === undefined) data.settings.theme = 'modern';
      if (data.settings.footerStyle === undefined) data.settings.footerStyle = 'clean';
      if (data.settings.publicMode === undefined) data.settings.publicMode = true;
      if (data.settings.autoRead === undefined) data.settings.autoRead = true;
    }
  },
  {
    id: 4,
    name: 'migrateGreetingFlags',
    up(data) {
      if (!data.groups) return;
      let migrated = 0;
      for (const jid of Object.keys(data.groups)) {
        const g = data.groups[jid];
        if (!g || typeof g !== 'object') continue;
        if ('welcome' in g && g.welcome === false) {
          delete g.welcome;
          migrated++;
        }
        if ('goodbye' in g && g.goodbye === false) {
          delete g.goodbye;
          migrated++;
        }
      }
      if (migrated > 0) {
        console.log(`[DB MIGRATION] Cleaned ${migrated} stale greeting flag(s) from existing groups.`);
      }
    }
  },
  {
    id: 5,
    name: 'addPluginStats',
    up(data) {
      if (!data.settings) data.settings = {};
      if (!data.settings.pluginStats || typeof data.settings.pluginStats !== 'object') {
        data.settings.pluginStats = {};
      }
    }
  },
  {
    id: 6,
    name: 'addConnectionStats',
    up(data) {
      if (!data.settings) data.settings = {};
      const defaultStats = {
        totalConnections: 0,
        disconnects: 0,
        lastConnected: null,
        lastDisconnected: null,
        uptime: 0
      };
      if (!data.settings.connectionStats || typeof data.settings.connectionStats !== 'object') {
        data.settings.connectionStats = defaultStats;
      } else {
        for (const [key, val] of Object.entries(defaultStats)) {
          if (data.settings.connectionStats[key] === undefined) {
            data.settings.connectionStats[key] = val;
          }
        }
      }
    }
  },
  {
    id: 7,
    name: 'addSudoOwners',
    up(data) {
      if (!data.settings) data.settings = {};
      if (!Array.isArray(data.settings.sudoOwners)) {
        data.settings.sudoOwners = [];
      }
    }
  },
  {
    id: 8,
    name: 'addBulkPortFields',
    up(data) {
      // Bulk port (2026-11-20): new user + group fields for the ported
      // LUNA MD plugins. Mirrors the defaults in db.js getUser/getGroup;
      // only fills fields that are still undefined, never overwrites.
      const userDefaults = {
        premiumTime: 0,
        lastmonthly: null,
        health: 100,
        stamina: 100,
        registered: false,
        name: '',
        age: 0,
        regTime: 0,
        limit: 0,
        tiketcoin: 0,
        pet: 0,
        fullatm: 0,
        lastadventure: 0,
        lasthunt: 0,
        lastfishing: 0,
        lastduel: 0,
        lastwar: 0,
        lastdungeon: 0,
        lastmining: 0,
        lastbansos: 0,
        lastclaim: 0,
        lastweekly: 0,
        lastnebang: 0,
        lastmulung: 0,
        lastnguli: 0,
        wood: 0,
        rock: 0,
        iron: 0,
        string: 0,
        coal: 0,
        diamond: 0,
        emerald: 0,
        gold: 0,
        trash: 0,
        potion: 0,
        botol: 0,
        kaleng: 0,
        kardus: 0,
        pickaxe: 0,
        pickaxedurability: 0,
        sword: 0,
        sworddurability: 0,
        axe: 0,
        axedurability: 0,
        fishingrod: 0,
        fishingroddurability: 0,
        armor: 0,
        armordurability: 0,
        atm: 0,
        common: 0,
        uncommon: 0,
        mythic: 0,
        legendary: 0,
        banteng: 0,
        harimau: 0,
        gajah: 0,
        kambing: 0,
        panda: 0,
        buaya: 0,
        kerbau: 0,
        sapi: 0,
        monyet: 0,
        babihutan: 0,
        babi: 0,
        ayam: 0,
        pisang: 0,
        anggur: 0,
        mangga: 0,
        jeruk: 0,
        apel: 0,
        chicken: 0,
        beef: 0,
        pork: 0,
        fish: 0,
        catfish: 0,
        tilapia: 0,
        pomfret: 0,
        shrimp: 0,
        whale: 0,
        crab: 0,
        grilledchicken: 0,
        friedchicken: 0,
        chickenopor: 0,
        chickencurry: 0,
        steak: 0,
        rendang: 0,
        roastpork: 0,
        grilledfish: 0,
        grilledcatfish: 0,
        grilledtilapia: 0,
        grilledpomfret: 0,
        grilledshrimp: 0,
        grilledwhale: 0,
        grilledcrab: 0,
      };
      if (!data.users) data.users = {};
      for (const jid of Object.keys(data.users)) {
        const user = data.users[jid];
        if (!user || typeof user !== 'object') continue;
        for (const [key, val] of Object.entries(userDefaults)) {
          if (user[key] === undefined) user[key] = val;
        }
      }
      const groupDefaults = {
        isBanned: false,
        nsfw: false,
        welcomeEnabled: true,
        byeText: null,
        promoteText: null,
        demoteText: null,
      };
      if (!data.groups) data.groups = {};
      for (const jid of Object.keys(data.groups)) {
        const group = data.groups[jid];
        if (!group || typeof group !== 'object') continue;
        for (const [key, val] of Object.entries(groupDefaults)) {
          if (group[key] === undefined) group[key] = val;
        }
      }
    }
  }
];

/**
 * Runs all pending migrations in order.
 * Tracks applied migration IDs in data.settings._migrations.
 * Logs each migration applied and saves database after completion.
 *
 * @param {object} data - Database state object
 * @param {function} [saveFn] - Optional function to save database state after migrations
 * @returns {object} - Mutated data object
 */
export function runMigrations(data, saveFn) {
  if (!data || typeof data !== 'object') {
    console.error('[DB MIGRATION] Invalid data provided to runMigrations.');
    return data;
  }

  validateSchema(data);

  if (!data.users) data.users = {};
  if (!data.groups) data.groups = {};
  if (!data.settings) data.settings = {};
  if (!Array.isArray(data.settings._migrations)) {
    data.settings._migrations = [];
  }

  const appliedMigrations = data.settings._migrations;
  let appliedCount = 0;

  // Execute pending migrations in ID order
  const sortedMigrations = [...migrations].sort((a, b) => a.id - b.id);

  for (const migration of sortedMigrations) {
    if (!appliedMigrations.includes(migration.id)) {
      try {
        console.log(`[DB MIGRATION] Running migration #${migration.id} (${migration.name})...`);
        migration.up(data);
        data.settings._migrations.push(migration.id);
        appliedCount++;
        console.log(`[DB MIGRATION] Applied migration #${migration.id} (${migration.name}) successfully.`);
      } catch (err) {
        console.error(`[DB MIGRATION] Failed migration #${migration.id} (${migration.name}):`, err.message);
      }
    }
  }

  if (appliedCount > 0) {
    console.log(`[DB MIGRATION] Completed ${appliedCount} migration(s).`);
    if (typeof saveFn === 'function') {
      saveFn(data);
    }
  }

  return data;
}
