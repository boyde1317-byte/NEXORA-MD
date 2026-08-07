import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from '../../config/index.js';
import brand from '../../config/brand.js';
import { db } from '../database/db.js';
import { handleMessage } from '../handlers/message.js';
import { restoreReminders } from '../plugins/utility/remind.js';
import { handleGroupParticipantsUpdate } from '../handlers/group.js';
import { client } from './client.js';
import { connectionMonitor } from './connectionMonitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const logger = pino({ level: 'silent' });

let reconnectAttempts = 0;
const BASE_DELAY_MS   = config.reconnectLimit === 0 ? 5000 : 5000;
const MAX_DELAY_MS    = config.keepAliveIntervalMs ? 60000 : 60000;

// ── Memory bounds for the in-memory message store ──────────────────────────
const MAX_MSGS_PER_CHAT = 500;
const MAX_TRACKED_CHATS = 2000;

/**
 * Exponential backoff delay: 5s, 10s, 20s, 40s … capped at 60s
 */
function getReconnectDelay(attempt) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
}

/**
 * Export connection state for the stats endpoint and health checks.
 * Reads from the connectionMonitor singleton.
 */
export function getConnectionState() {
  const health  = connectionMonitor.getHealth();
  const metrics = connectionMonitor.getMetrics();
  const stats   = connectionMonitor.getReconnectStats();
  const state   = connectionMonitor.getState();
  const history = connectionMonitor.getStateHistory();

  return {
    current:            state,
    lastConnectTime:    health.uptime > 0 ? Date.now() - health.uptime : null,
    totalConnects:      stats.successfulReconnects + 1, // +1 for initial connect (not a reconnect)
    totalDisconnects:   stats.failedReconnects,
    totalMessages:      health.totalMessages,
    totalCommands:      metrics.commandsExecuted,
    totalErrors:        health.totalErrors,
    lastIncomingTime:   health.lastIncomingAge != null ? Date.now() - health.lastIncomingAge : null,
    lastOutgoingTime:   health.lastOutgoingAge != null ? Date.now() - health.lastOutgoingAge : null,
    reconnectHistory:   connectionMonitor.getReconnectHistory(),
    stateHistory:       history,
    uptime:             health.uptime,
    latency:             connectionMonitor.heartbeat.getLatency(),
  };
}

export async function connectToWhatsApp() {
  console.log('[CONNECTION] Initializing WhatsApp multi-device connection...');
  connectionMonitor.recordConnecting();

  // Ensure session directory exists
  const sessionDir = path.resolve(config.sessionPath);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Fetch latest Baileys protocol version for compatibility
  let version;
  try {
    const { version: v } = await fetchLatestBaileysVersion();
    version = v;
    console.log(`[CONNECTION] Using WA version: ${v.join('.')}`);
  } catch {
    // Updated fallback to match fork's bundled version
    version = [2, 3000, 1044479778];
    console.warn('[CONNECTION] Could not fetch latest version — using bundled fallback.');
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    printQRInTerminal: !config.pairing.enabled,
    browser: ['Ubuntu', 'Chrome', '20.0.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false,
    connectTimeoutMs: config.connectTimeoutMs || 60000,
    keepAliveIntervalMs: config.keepAliveIntervalMs || 30000,
    retryRequestDelayMs: 2000,
    // In-memory message store for retries and quoted message decryption.
    messageStore: new Map(),
    getMessage: async (key) => {
      const chat = key?.remoteJid;
      if (!chat) return { conversation: '' };
      const store = sock.opts?.messageStore;
      if (!store) return { conversation: '' };
      const msgs = store.get(chat);
      if (!msgs) return { conversation: '' };
      const msg = msgs.get(key.id);
      return msg || { conversation: '' };
    }
  });

  client.socket = sock;

  // ── Pairing code request ──────────────────────────────────────────────────
  if (config.pairing.enabled && !sock.authState.creds.me) {
    if (!config.pairing.phoneNumber) {
      console.error('[CONNECTION] Pairing mode enabled but no phoneNumber set in .env (PAIRING_PHONE)');
    } else {
      setTimeout(async () => {
        try {
          const cleanPhone = config.pairing.phoneNumber.replace(/[^0-9]/g, '');
          console.log(`[CONNECTION] Requesting pairing code for: ${cleanPhone}`);
          const code = await sock.requestPairingCode(cleanPhone);
          console.log(`\n${'='.repeat(50)}`);
          console.log(`🔑 WHATSAPP PAIRING CODE: ${code}`);
          console.log(`👉 Go to WhatsApp → Settings → Linked Devices → Link a Device`);
          console.log(`   Then tap "Link with phone number instead" and enter the code above.`);
          console.log(`${'='.repeat(50)}\n`);
        } catch (err) {
          console.error('[CONNECTION] Failed to request pairing code:', err.message || err);
        }
      }, 5000);
    }
  }

  // ── Auth credentials persistence ──────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── Connection lifecycle ──────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !config.pairing.enabled) {
      console.log('[CONNECTION] Scan this QR code to authenticate:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'connecting') {
      console.log('[CONNECTION] Connecting to WhatsApp servers...');

    } else if (connection === 'open') {
      reconnectAttempts = 0;
      connectionMonitor.recordConnected(sock);

      const health  = connectionMonitor.getHealth();
      const stats   = connectionMonitor.getReconnectStats();

      console.log(`\n╭───────────────────────────────────╮`);
      console.log(`│         ${brand.name} v${brand.version}         │`);
      console.log(`│                                   │`);
      console.log(`│         ${brand.signature}              │`);
      console.log(`│                                   │`);
      console.log(`│       Successfully Online          │`);
      console.log(`╰───────────────────────────────────╯\n`);
      console.log(`🤖 Logged in as: ${sock.user?.name || 'Bot'} (${sock.user?.id?.split(':')[0]})\n`);
      console.log(`[CONNECTION] Total connects: ${stats.successfulReconnects + 1}, Total disconnects: ${stats.failedReconnects}\n`);

      // Restore any pending reminders from the database after reconnect
      restoreReminders(sock);

    } else if (connection === 'close') {
      const statusCode   = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || 'Unknown';
      console.log(`[CONNECTION] Disconnect — statusCode: ${statusCode}, reason: ${errorMessage}`);

      connectionMonitor.recordDisconnect(errorMessage, statusCode, errorMessage);

      // Determine whether this disconnect is recoverable
      const loggedOut          = statusCode === DisconnectReason.loggedOut;
      const connectionReplaced = statusCode === DisconnectReason.connectionReplaced;
      const badSession         = statusCode === DisconnectReason.badSession;

      if (loggedOut) {
        console.error('[CONNECTION] Session logged out by WhatsApp — clearing session and scheduling re-pair in 30s...');
        db.saveSync();
        try {
          const files = fs.readdirSync(sessionDir);
          for (const f of files) fs.rmSync(path.join(sessionDir, f), { force: true });
          console.log('[CONNECTION] Session cleared. Will attempt re-pair in 30 seconds...');
        } catch (e) {
          console.error('[CONNECTION] Failed to clear session:', e.message);
        }
        reconnectAttempts = 0;
        setTimeout(connectToWhatsApp, 30000);
        return;
      }

      if (connectionReplaced) {
        console.error('[CONNECTION] Another device opened this session. Bot shutting down to avoid conflicts.');
        db.saveSync();
        process.exit(1);
        return;
      }

      if (badSession) {
        console.error('[CONNECTION] Bad session file detected. Delete session/ and re-pair.');
        db.saveSync();
        process.exit(1);
        return;
      }

      // Recoverable disconnect — attempt reconnect with exponential backoff
      console.warn(`[CONNECTION] Closed (code: ${statusCode}, reason: ${errorMessage}). Attempting reconnect...`);

      // 0 = unlimited reconnects (production), >0 = limited attempts
      const maxAttempts = config.reconnectLimit;
      if (maxAttempts === 0 || reconnectAttempts < maxAttempts) {
        reconnectAttempts++;
        const delay = getReconnectDelay(reconnectAttempts);
        console.log(`[CONNECTION] Reconnect attempt ${reconnectAttempts}${maxAttempts > 0 ? `/${maxAttempts}` : ' (unlimited)'} in ${delay / 1000}s...`);
        connectionMonitor.recordReconnectAttempt(errorMessage, reconnectAttempts);
        setTimeout(connectToWhatsApp, delay);
      } else {
        console.error(`[CONNECTION] Max reconnect attempts (${maxAttempts}) reached. Shutting down.`);
        db.saveSync();
        process.exit(1);
      }
    }
  });

  // ── Incoming messages ─────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    if (chatUpdate.type !== 'notify') return;

    for (const rawMessage of chatUpdate.messages) {
      connectionMonitor.recordIncomingMessage(rawMessage);

      // Cache message for getMessage retries
      try {
        const chat = rawMessage?.key?.remoteJid;
        if (chat && rawMessage?.key?.id) {
          const store = sock.opts.messageStore;

          // Evict oldest chat if we've hit the max tracked chats limit
          if (!store.has(chat) && store.size >= MAX_TRACKED_CHATS) {
            const oldestChat = store.keys().next().value;
            store.delete(oldestChat);
          }

          if (!store.has(chat)) {
            store.set(chat, new Map());
          }

          const chatMsgs = store.get(chat);
          chatMsgs.set(rawMessage.key.id, rawMessage);

          // Bound memory: keep last MAX_MSGS_PER_CHAT messages per chat
          if (chatMsgs.size > MAX_MSGS_PER_CHAT) {
            const firstKey = chatMsgs.keys().next().value;
            chatMsgs.delete(firstKey);
          }
        }
      } catch (_) {}

      try {
        await handleMessage(rawMessage, sock);
      } catch (err) {
        connectionMonitor.recordErrorCaught(err);
        console.error('[HANDLER ERROR] Uncaught error in message handler:', err.message || err);
      }
    }
  });

  // ── Group participant events ───────────────────────────────────────────────
  sock.ev.on('group-participants.update', async (update) => {
    connectionMonitor.recordGroupEvent(update);
    try {
      await handleGroupParticipantsUpdate(update, sock);
    } catch (err) {
      console.error('[HANDLER ERROR] Uncaught error in group handler:', err.message || err);
    }
  });

  // ── Anti-call ────────────────────────────────────────────────────────────
  sock.ev.on('call', async (calls) => {
    if (!config.features?.antiCall || !db.getSettings().anticall) return;
    for (const call of calls) {
      if (call.status !== 'offer') continue;
      try {
        await sock.rejectCall(call.id, call.from);
        await sock.sendMessage(call.chatId || call.from, {
          text: '📵 This account does not accept calls. Your call was automatically declined.'
        }).catch(() => {});
      } catch (err) {
        console.error('[ANTICALL] Failed to reject call:', err.message || err);
      }
    }
  });

  // ── Presence updates ──────────────────────────────────────────────────────
  // Track presence to detect stale connections
  sock.ev.on('presence.update', (update) => {
    // Presence updates indicate the connection is alive — record as incoming
    connectionMonitor.heartbeat.recordIncoming();
  });

  // ── Messages sent tracking ────────────────────────────────────────────────
  // connectionMonitor.attachSocket(sock) patches sendMessage to record outgoing
  // messages automatically — no need for a manual wrapper here.

  return sock;
}

export default connectToWhatsApp;
