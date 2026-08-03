import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(process.cwd(), config.dbPath);

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

let _data = loadDb();

export const db = {
  data: _data,

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
        welcome: false,
        goodbye: false,
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

  saveSync() { saveDb(_data); },
  save() {
    
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => saveDb(_data), 2000);

  },

  reload() {
    _data = loadDb();
    this.data = _data;
  }
};

export default db;
