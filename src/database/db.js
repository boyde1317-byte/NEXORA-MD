import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DB_PATH = path.resolve(process.cwd(), config.dbPath);

// ── Auto-save interval: flush to disk every 60s even if no explicit save
//    is triggered. Prevents data loss if the process is SIGKILL'd (e.g.
//    Docker OOM) without hitting the graceful-shutdown handler.
const AUTO_SAVE_INTERVAL_MS = 60_000;

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
    // Try backup before returning empty to prevent data loss
    const backupPath = `${DB_PATH}.bak`;
    if (fs.existsSync(backupPath)) {
      console.warn('[DB] Attempting restoration from backup file...');
      try {
        return JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      } catch (_) {}
    }
    // No backup available — return empty but log loudly
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
    // Write to temp file first
    fs.writeFileSync(tempPath, serialized, 'utf-8');
    // Backup current valid file before replacing
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
    }
    // Atomic rename — no partial writes possible
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (err) {
    console.error('[DB] Failed to save database:', err.message);
    return false;
  }
}

// ── One-time migration: remove stale welcome/goodbye defaults ─────────────
// Previous versions set welcome: false / goodbye: false as the default for
// every group. These should be treated as "not set" (use global default),
// not as "explicitly disabled". We delete them from existing group records
// so the new _isGreetingEnabled logic falls back to the global config.
function migrateGreetingFlags(data) {
  if (!data.groups) return;
  let migrated = 0;
  for (const jid of Object.keys(data.groups)) {
    const g = data.groups[jid];
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
    saveDb(data);
  }
}

let _data = loadDb();
migrateGreetingFlags(_data);

export const db = {
  data: _data,
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
        createdAt: Date.now()
      };
    }
    return _data.users[jid];
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
        // welcome/goodbye are NOT set here — undefined means "use global default".
        // They are only set to true/false when the owner explicitly toggles
        // via .welcome on/off or .goodbye on/off inside the group.
        antilink: false,
        mute: false,
        createdAt: Date.now()
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
    // Cancel any pending debounced save before flushing synchronously
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    saveDb(_data);
  },

  save() {
    // Debounced write — coalesces rapid successive mutations into a single
    // disk write. The auto-save interval acts as a safety net so even if
    // the debounce is never triggered, data still hits disk every 60s.
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      saveDb(_data);
    }, 2000);
  },

  /** Start the periodic auto-save safety net. Call once on startup. */
  startAutoSave() {
    if (this._autoSaveInterval) return;
    this._autoSaveInterval = setInterval(() => {
      saveDb(_data);
    }, AUTO_SAVE_INTERVAL_MS);
    // Don't keep the process alive just for auto-save
    this._autoSaveInterval.unref();
  },

  /** Stop the periodic auto-save (called during graceful shutdown). */
  stopAutoSave() {
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
      this._autoSaveInterval = null;
    }
  },

  reload() {
    _data = loadDb();
    this.data = _data;
  }
};

// Start the auto-save safety net on module load
db.startAutoSave();

export default db;
