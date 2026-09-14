/**
 * sessionManager.js — additional linked WhatsApp sessions for the bot.
 *
 * `.pair <number>` spawns a fresh baileys socket with its own auth folder
 * (session/extras/<phone>/), requests a pairing code for the OTHER number,
 * and — once the code is entered on that phone — the paired number comes
 * online as a full second NEXORA instance: same plugin dispatcher
 * (handleMessage), same group-event handler, same rich-message stack.
 *
 * Design notes:
 *  - Socket presentation mirrors the main connection exactly (Moonson-proven
 *    macOS/Safari browser tuple, latest WA version, markOnlineOnConnect) —
 *    see src/core/connection.js.
 *  - Pairing codes are requested ONLY after the `qr` event proves the
 *    WebSocket is live (same lesson as the main connection's cold-start race).
 *  - Every socket keeps ONE code per lifetime; a new socket = a new code,
 *    and WA invalidates all older codes.
 *  - creds with a stale (never-completed) link attempt are cleared before a
 *    new pair — stale creds.me otherwise makes every later boot look
 *    "already paired" and no fresh code is ever requested.
 *  - Extra session dirs live under <sessionPath>/extras/<phone>/ so they
 *    inherit the same persistent volume as the main session on every
 *    deployment; the main connection's logged-out wipe skips directories.
 *
 * FULL-BOT MODE (2026-09-14): an extra session is an independent bot for its
 * own account. Everything the paired number's owner types arrives with
 * key.fromMe on their companion socket, so unlike the main connection these
 * sessions PROCESS fromMe — but only in groups and their self-chat, never in
 * their private DMs with other people (no leaking bot replies into the
 * owner's personal conversations). serializer.resolveIsOwner treats the
 * session's own account as that session's owner. Echo and cross-bot loops
 * are blocked by tracking outgoing message ids and skipping messages
 * authored by other linked bots (the main connection does the same for
 * messages authored by extras).
 */
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} from 'baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

import { config } from '../../config/index.js';
import { client } from './client.js';
import { handleMessage } from '../handlers/message.js';
import { handleGroupParticipantsUpdate } from '../handlers/group.js';

const logger = pino({ level: 'silent' });

/** Max simultaneously active extra sessions — protects memory/host. */
export const MAX_EXTRA_SESSIONS = 5;

/** Window the pairing socket stays open waiting for the code entry. */
const PAIRING_WINDOW_MS = 3 * 60 * 1000;

/** Reconnect backoff for already-linked sessions. */
const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000;
const RECONNECT_MAX_ATTEMPTS = 10;

/** Root folder for extra-session auth state. */
function extrasRoot() {
  return path.resolve(config.sessionPath, 'extras');
}

/** Registry of every extra session this process knows about. */
const sessions = new Map(); // phone → entry
let resuming = false;

function sessionDir(phone) {
  return path.join(extrasRoot(), phone);
}

/** Normalize user input to plain digits (accepts +, spaces, JIDs). */
function normalizePhone(raw) {
  return String(raw || '')
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/[^\d]/g, '');
}

function isRegistered(dir) {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(dir, 'creds.json'), 'utf8'));
    return Boolean(creds?.registered);
  } catch (_) {
    return false;
  }
}

/** Wipe a session dir (recursive, safe if missing). */
function wipeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

/** Send a status line to the owner via the MAIN socket (never throws). */
async function notifyMain(notifyJid, text) {
  try {
    if (notifyJid && client.socket?.user) {
      await client.socket.sendMessage(notifyJid, { text });
    }
  } catch (_) {}
}

/**
 * Phone numbers of every linked bot socket (main + extras), excluding the
 * given one — used by both this module and the main connection to skip
 * messages authored by other linked bots (loop guard).
 */
export function getLinkedBotPhones(excludePhone) {
  const phones = new Set();
  const main = client.socket?.user?.id?.split(':')[0]?.split('@')[0];
  if (main) phones.add(main);
  for (const p of sessions.keys()) phones.add(p);
  phones.delete(excludePhone);
  return [...phones];
}

/** List every extra session, active or on-disk. */
export function listSessions() {
  const out = [];
  for (const [phone, s] of sessions.entries()) {
    out.push({
      phone,
      jid: s.jid || null,
      name: s.name || null,
      status: s.status,
      connectedAt: s.connectedAt || null,
      lastError: s.lastError || null,
      active: s.status === 'online',
    });
  }
  return out;
}

/**
 * Build and connect one extra session socket.
 * `phase` is 'pairing' (fresh, waiting for code entry) or 'resume'
 * (creds registered, just reconnecting).
 */
async function spawnSessionSocket(phone, phase, notifyJid) {
  const entry = sessions.get(phone);
  const dir = sessionDir(phone);
  fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);

  let version;
  try {
    const { version: v } = await fetchLatestBaileysVersion();
    version = v;
  } catch (_) {
    version = undefined;
  }

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    // Same proven presentation as the main connection — see header notes.
    browser: Browsers.macOS('Safari'),
    markOnlineOnConnect: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
    messageStore: new Map(),
    getMessage: async (key) => {
      const chat = key?.remoteJid;
      const store = sock.opts?.messageStore;
      const msgs = chat && store ? store.get(chat) : null;
      const msg = msgs ? msgs.get(key.id) : null;
      return msg || { conversation: '' };
    }
  });

  entry.sock = sock;
  entry.reconnectAttempts = entry.reconnectAttempts || 0;

  // ── Full-bot mode markers ────────────────────────────────────────────────
  // serializer.resolveIsOwner and handleMessage's guards key off these.
  sock._nexoraExtraSession = true;
  sock._nexoraSessionPhone = phone;

  // Echo guard: this session processes fromMe, so its own outgoing sends
  // must never re-enter handleMessage (the bot would answer itself).
  const sentIds = new Set();
  const origSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...args) => {
    const result = await origSendMessage(...args);
    try {
      const id = result?.key?.id;
      if (id) {
        sentIds.add(id);
        if (sentIds.size > 3000) sentIds.delete(sentIds.values().next().value);
      }
    } catch (_) {}
    return result;
  };

  sock.ev.on('creds.update', saveCreds);

  let codeRequested = false;
  let pairingTimer = null;

  const teardownPairing = async (reason) => {
    if (pairingTimer) clearTimeout(pairingTimer);
    entry.status = 'failed';
    entry.lastError = reason;
    entry.sock = null;
    try { sock.ev.removeAllListeners(); } catch (_) {}
    try { sock.end(undefined); } catch (_) {}
    // creds.me set by requestPairingCode without a completed link is stale —
    // wipe it so the next .pair starts truly fresh (see header notes).
    wipeDir(dir);
    await notifyMain(
      notifyJid,
      `⚠️ Pairing for +${phone} did not complete (${reason}). Run .pair ${phone} again for a fresh code.`
    );
  };

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && phase === 'pairing' && !codeRequested && !sock.authState.creds.registered) {
      codeRequested = true;
      try {
        const code = await sock.requestPairingCode(phone);
        entry.pairingCode = code;
        entry.status = 'awaiting_code';
        // Pairing window: if the code isn't entered in time, tear down.
        pairingTimer = setTimeout(() => {
          if (!sock.authState.creds.registered) {
            teardownPairing('code expired / not entered');
          }
        }, PAIRING_WINDOW_MS);
        await notifyMain(
          notifyJid,
          `🔑 *Pairing code for +${phone}:* *${code}*\n\nOn that phone: WhatsApp → Settings → Linked Devices → Link a Device → *Link with phone number instead*, then enter the code.\nDigits only — WhatsApp adds the dash itself. Code expires in a couple of minutes; I'll confirm here when it links.`
        );
      } catch (err) {
        await teardownPairing(`code request failed: ${err.message || err}`);
      }
      return;
    }

    if (connection === 'open') {
      if (pairingTimer) clearTimeout(pairingTimer);
      entry.status = 'online';
      entry.jid = sock.user?.id || `${phone}@s.whatsapp.net`;
      entry.name = sock.user?.name || null;
      entry.connectedAt = Date.now();
      entry.reconnectAttempts = 0;
      if (phase === 'pairing') {
        console.log(`[SESSION] +${phone} linked — online as ${entry.name || phone}`);
        await notifyMain(notifyJid, `🎉 +${phone} is now linked and online${entry.name ? ` as *${entry.name}*` : ''} — it now runs as its own NEXORA bot: commands its owner types in groups or their self-chat get full bot replies (owner-only and private-mode gates apply to that owner's number).`);
      } else {
        console.log(`[SESSION] +${phone} reconnected`);
      }
      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        entry.status = 'logged_out';
        entry.sock = null;
        try { sock.ev.removeAllListeners(); } catch (_) {}
        wipeDir(dir);
        sessions.delete(phone);
        console.log(`[SESSION] +${phone} logged out by WhatsApp — session removed`);
        await notifyMain(notifyJid, `🚫 +${phone} was logged out (device removed on that phone or by WhatsApp) — session files cleaned.`);
        return;
      }

      if (phase === 'pairing') {
        // Socket closed before the code was entered — dead code, dead creds.
        await teardownPairing(`socket closed (status ${statusCode ?? 'unknown'}) before the code was entered`);
        return;
      }

      // Linked session dropped — reconnect with backoff.
      entry.status = 'reconnecting';
      entry.sock = null;
      const attempts = (entry.reconnectAttempts || 0) + 1;
      entry.reconnectAttempts = attempts;
      if (attempts > RECONNECT_MAX_ATTEMPTS) {
        sessions.delete(phone);
        await notifyMain(notifyJid, `⚠️ +${phone} failed to reconnect ${RECONNECT_MAX_ATTEMPTS} times — session dropped. Run .pair ${phone} to re-link it.`);
        return;
      }
      const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempts - 1), RECONNECT_MAX_MS);
      console.log(`[SESSION] +${phone} reconnect attempt ${attempts} in ${delay / 1000}s`);
      setTimeout(() => {
        spawnSessionSocket(phone, 'resume', notifyJid).catch((err) => {
          console.error(`[SESSION] +${phone} reconnect failed:`, err.message || err);
        });
      }, delay);
    }
  });

  // ── Incoming messages: same dispatch as the main connection ──────────────
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    if (chatUpdate.type !== 'notify') return;
    for (const rawMessage of chatUpdate.messages) {
      const key = rawMessage?.key;
      if (!key?.remoteJid) continue;

      // Never re-process our own outgoing sends (echo guard, see header).
      if (sentIds.has(key.id)) continue;

      // fromMe here = the paired account's own messages. Full-bot mode runs
      // their commands in groups and their self-chat ONLY — never in their
      // private chats with other people, where a bot reply would leak into
      // the owner's personal conversations.
      if (key.fromMe) {
        const isGroup  = key.remoteJid.endsWith('@g.us');
        const selfChat = key.remoteJid.split('@')[0].split(':')[0] === phone;
        if (!isGroup && !selfChat) continue;
      }

      // Cross-bot guard: skip messages authored by the main bot or another
      // linked session, so paired bots never react to each other's replies
      // (and cannot be chained into loops in shared groups).
      if (!key.remoteJid.endsWith('@g.us') || key.participant) {
        const authorJid = key.participant || key.remoteJid;
        const authorPhone = String(authorJid).split('@')[0].split(':')[0];
        if (authorPhone !== phone && getLinkedBotPhones(phone).includes(authorPhone)) continue;
      }

      // Cache for getMessage retries (bounded like the main store)
      try {
        const chat = rawMessage?.key?.remoteJid;
        if (chat && rawMessage?.key?.id) {
          const store = sock.opts.messageStore;
          if (!store.has(chat)) store.set(chat, new Map());
          const chatMsgs = store.get(chat);
          chatMsgs.set(rawMessage.key.id, rawMessage);
          if (chatMsgs.size > 500) chatMsgs.delete(chatMsgs.keys().next().value);
        }
      } catch (_) {}
      try {
        await handleMessage(rawMessage, sock);
      } catch (err) {
        console.error(`[SESSION] +${phone} handler error:`, err.message || err);
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleGroupParticipantsUpdate(update, sock);
    } catch (err) {
      console.error(`[SESSION] +${phone} group handler error:`, err.message || err);
    }
  });

  return sock;
}

/**
 * Start a pairing flow for a new number.
 * Resolves immediately with { phone, status } — the code itself is delivered
 * as a follow-up message to `notifyJid` once WA issues it, because the code
 * only exists after the socket's WS session is live.
 */
export async function pairSession(rawPhone, { notifyJid } = {}) {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 7) {
    throw new Error('That does not look like a valid phone number — include the country code, e.g. `.pair 2335XXXXXXXX`.');
  }

  // Can't pair the main bot's own number
  const mainPhone = client.socket?.user?.id?.split(':')[0]?.split('@')[0];
  if (mainPhone && phone === mainPhone) {
    throw new Error('That is the main bot number — it is already running here.');
  }

  const existing = sessions.get(phone);
  if (existing && (existing.status === 'online' || existing.status === 'awaiting_code')) {
    throw new Error(
      existing.status === 'online'
        ? `+${phone} is already linked and online. Use .delsession ${phone} first if you want to re-pair it.`
        : `A pairing code for +${phone} was just issued and is still waiting to be entered.`
    );
  }

  const activeCount = [...sessions.values()].filter((s) => s.status === 'online' || s.status === 'awaiting_code' || s.status === 'reconnecting').length;
  if (activeCount >= MAX_EXTRA_SESSIONS) {
    throw new Error(`Session limit reached (${MAX_EXTRA_SESSIONS}). Remove one with .delsession <number> first.`);
  }

  const dir = sessionDir(phone);
  if (fs.existsSync(dir)) {
    if (isRegistered(dir)) {
      throw new Error(`+${phone} already has a saved session on disk. It will reconnect automatically — or remove it with .delsession ${phone}.`);
    }
    // Stale, never-completed link attempt — start fresh (see header notes).
    wipeDir(dir);
  }

  sessions.set(phone, {
    phone,
    status: 'starting',
    sock: null,
    jid: null,
    name: null,
    connectedAt: null,
    lastError: null,
    reconnectAttempts: 0,
    pairingCode: null,
  });

  await spawnSessionSocket(phone, 'pairing', notifyJid);
  return { phone, status: sessions.get(phone).status };
}

/**
 * Reconnect every saved (already-linked) extra session at boot.
 */
export async function resumeExtraSessions() {
  if (resuming) return;
  resuming = true;
  try {
    const root = extrasRoot();
    if (!fs.existsSync(root)) return;
    const dirs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'creds.json')));
    for (const phone of dirs) {
      if (sessions.has(phone)) continue;
      if (!isRegistered(path.join(root, phone))) continue;
      sessions.set(phone, {
        phone,
        status: 'starting',
        sock: null,
        jid: `${phone}@s.whatsapp.net`,
        name: null,
        connectedAt: null,
        lastError: null,
        reconnectAttempts: 0,
        pairingCode: null,
      });
      console.log(`[SESSION] Resuming saved session +${phone}`);
      spawnSessionSocket(phone, 'resume', null).catch((err) => {
        console.error(`[SESSION] Resume of +${phone} failed:`, err.message || err);
      });
    }
  } finally {
    resuming = false;
  }
}

/**
 * Log out and remove an extra session.
 */
export async function removeSession(rawPhone) {
  const phone = normalizePhone(rawPhone);
  const entry = sessions.get(phone);
  const dir = sessionDir(phone);
  const onDisk = fs.existsSync(dir);

  if (!entry && !onDisk) {
    throw new Error(`No session found for +${phone}. Check .sessions for the list.`);
  }

  if (entry?.sock) {
    try {
      await entry.sock.logout();
    } catch (_) {
      try { entry.sock.end(undefined); } catch (_) {}
    }
    try { entry.sock.ev.removeAllListeners(); } catch (_) {}
  }

  wipeDir(dir);
  sessions.delete(phone);

  return {
    phone,
    wasOnline: entry?.status === 'online',
    message: `Session for +${phone} removed and logged out.`,
  };
}
