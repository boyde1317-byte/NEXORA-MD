import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';
import { runMigrations, validateSchema } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DB_PATH = path.resolve(process.cwd(), config.dbPath);

// ── Auto-save interval ──────────────────────────────────────────────────────
const AUTO_SAVE_INTERVAL_MS = config.dbAutoSaveIntervalMs || 60_000;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadDb() {
  try {
    ensureDir(DB_PATH);
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, groups: {}, settings: {} }, null, 2), 'utf-8');
    }
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[DB CRITICAL] Failed to load database:', err.message);
    const backupPath = `${DB_PATH}.bak`;
    if (fs.existsSync(backupPath)) {
      console.warn('[DB] Attempting restoration from backup file...');
      try {
        return JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      } catch (_) {}
    }
    console.error('[DB CRITICAL] No valid backup found. Starting with empty database.');
    return { users: {}, groups: {}, settings: {} };
  }
}

function saveDb(data) {
  try {
    ensureDir(DB_PATH);
    const tempPath = `${DB_PATH}.tmp`;
    const backupPath = `${DB_PATH}.bak`;
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
    }
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (err) {
    console.error('[DB] Failed to save database:', err.message);
    return false;
  }
}

// ── Load and migrate ──────────────────────────────────────────────────────────
let _data = loadDb();

// Run migration system (replaces the old inline migrateGreetingFlags)
runMigrations(_data, (data) => saveDb(data));

export const db = {
  data: _data,
  _dirty: false,
  _saveTimeout: null,
  _autoSaveInterval: null,

  get(key) {
    return _data[key];
  },

  set(key, value) {
    _data[key] = value;
    this.save();
  },

  getUser(jid) {
    if (!_data.users) _data.users = {};
    if (!_data.users[jid]) {
      _data.users[jid] = {
        jid,
        banned: false,
        premium: false,
        warnings: 0,
        hasOnboarded: false,
        createdAt: Date.now(),
        xp: 0,
        coins: 0,
        level: 0,
        streak: 0,
        lastDaily: null,
        // ── Bulk port (2026-11-20): premium + monthly reward ──
        premiumTime: 0, // epoch ms when premium expires; 0 = none (null = permanent, set by .addprem)
        lastmonthly: null, // .monthly claim timestamp
        // ── Bulk port (2026-11-20): RPG user fields ──
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
        // RPG cooldown timestamps (0 = never)
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
        // RPG materials
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
        // RPG tools (count + durability)
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
        // RPG crates
        common: 0,
        uncommon: 0,
        mythic: 0,
        legendary: 0,
        // RPG animals (coop livestock; sapi/babi/ayam double as cooking ingredients)
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
        // RPG fruits
        pisang: 0,
        anggur: 0,
        mangga: 0,
        jeruk: 0,
        apel: 0,
        // RPG raw food ingredients
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
        // RPG cooked dishes
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
    }
    // Normalize corrupt numeric fields. A legacy or hand-edited record can
    // carry coins: "100" (string) or xp: NaN — left alone, every subsequent
    // arithmetic op compounds the corruption ("100" + 50 = "10050").
    const u = _data.users[jid];
    if (typeof u.coins !== 'number' || !Number.isFinite(u.coins) || u.coins < 0) u.coins = Math.max(0, Math.floor(Number(u.coins) || 0));
    if (typeof u.xp !== 'number' || !Number.isFinite(u.xp) || u.xp < 0) u.xp = Math.max(0, Math.floor(Number(u.xp) || 0));
    if (typeof u.level !== 'number' || !Number.isFinite(u.level) || u.level < 0) u.level = Math.max(0, Math.floor(Number(u.level) || 0));
    if (typeof u.warnings !== 'number' || !Number.isFinite(u.warnings) || u.warnings < 0) u.warnings = Math.max(0, Math.floor(Number(u.warnings) || 0));
    if (typeof u.streak !== 'number' || !Number.isFinite(u.streak) || u.streak < 0) u.streak = Math.max(0, Math.floor(Number(u.streak) || 0));
    return u;
  },

  setUser(jid, data) {
    if (!_data.users) _data.users = {};
    _data.users[jid] = { ...this.getUser(jid), ...data };
    this.save();
  },

  getGroup(jid) {
    if (!_data.groups) _data.groups = {};
    if (!_data.groups[jid]) {
      _data.groups[jid] = {
        jid,
        antilink: false,
        antitag: false,
        mute: false,
        warnings: {},
        createdAt: Date.now(),
        // ── Bulk port (2026-11-20) ──
        isBanned: false, // .banchat/.unbanchat; enforced in src/handlers/message.js
        nsfw: false, // adult search/download gates (ph2/ph3/phsearch/pornhubdl); no .nsfw toggle yet
        welcomeEnabled: true, // .welcome2 toggle; the greeting renderer does not read it yet (follow-up)
        byeText: null, // .setbye; the greeting renderer does not read it yet (follow-up)
        promoteText: null, // .setpromote; same
        demoteText: null, // .setdemote; same
      };
    }
    return _data.groups[jid];
  },

  setGroup(jid, data) {
    if (!_data.groups) _data.groups = {};
    _data.groups[jid] = { ...this.getGroup(jid), ...data };
    this.save();
  },

  getSettings() {
    if (!_data.settings) _data.settings = {};
    return _data.settings;
  },

  setSettings(data) {
    if (!_data.settings) _data.settings = {};
    _data.settings = { ...this.getSettings(), ...data };
    this.save();
  },

  saveSync() {
    if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
    if (this._maxSaveTimer) { clearTimeout(this._maxSaveTimer); this._maxSaveTimer = null; }
    if (saveDb(_data)) this._dirty = false;
  },

  save() {
    this._dirty = true;
    // Debounce rapid writes, BUT with a hard ceiling: under continuous
    // traffic the sliding timer used to be reset forever and the disk
    // write never happened — a container restart then lost EVERYTHING
    // since the last quiet moment. _maxSaveTimer guarantees a flush at
    // least every 10s no matter how busy the bot is.
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      this.flushSave();
    }, 2000);
    if (!this._maxSaveTimer) {
      this._maxSaveTimer = setTimeout(() => {
        this._maxSaveTimer = null;
        this.flushSave();
      }, 10000);
    }
  },

  flushSave() {
    if (this._saveTimeout) { clearTimeout(this._saveTimeout); this._saveTimeout = null; }
    if (this._maxSaveTimer) { clearTimeout(this._maxSaveTimer); this._maxSaveTimer = null; }
    if (this._dirty && saveDb(_data)) this._dirty = false;
  },

  startAutoSave() {
    if (this._autoSaveInterval) return;
    this._autoSaveInterval = setInterval(() => {
      if (this._dirty && saveDb(_data)) this._dirty = false;
    }, AUTO_SAVE_INTERVAL_MS);
    this._autoSaveInterval.unref();
  },

  stopAutoSave() {
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
      this._autoSaveInterval = null;
    }
  },

  reload() {
    _data = loadDb();
    runMigrations(_data, (data) => saveDb(data));
    this.data = _data;
  },

  /**
   * Get database statistics summary.
   * @returns {object} Stats object with counts
   */
  getStats() {
    return {
      users: Object.keys(_data.users || {}).length,
      groups: Object.keys(_data.groups || {}).length,
      bannedUsers: Object.values(_data.users || {}).filter(u => u.banned).length,
      premiumUsers: Object.values(_data.users || {}).filter(u => u.premium).length,
      totalXp: Object.values(_data.users || {}).reduce((sum, u) => sum + (u.xp || 0), 0),
      totalCoins: Object.values(_data.users || {}).reduce((sum, u) => sum + (u.coins || 0), 0),
      migrations: _data.settings?._migrations?.length || 0,
    };
  },
};

db.startAutoSave();

export default db;
