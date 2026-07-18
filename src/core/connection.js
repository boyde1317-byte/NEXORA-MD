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
import { handleGroupParticipantsUpdate } from '../handlers/group.js';
import { client } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const logger = pino({ level: 'silent' });

let reconnectAttempts = 0;
const BASE_DELAY_MS   = 5000;
const MAX_DELAY_MS    = 60000;

/**
 * Exponential backoff delay: 5s, 10s, 20s, 40s … capped at 60s
 */
function getReconnectDelay(attempt) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
}

export async function connectToWhatsApp() {
  console.log('[CONNECTION] Initializing WhatsApp multi-device connection...');

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
    version = [2, 3000, 1015901307];
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
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
    // Required for proper message retry / decryption on some WA versions
    getMessage: async (key) => {
      return { conversation: '' };
    }
  });

  client.socket = sock;

  // ── Pairing code request ──────────────────────────────────────────────────
  if (config.pairing.enabled && !sock.authState.creds.me) {
    if (!config.pairing.phoneNumber) {
      console.error('[CONNECTION] Pairing mode enabled but no phoneNumber set in config/index.js');
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
      console.log(`\n╭─────────────────────╮`);
      console.log(`│      NEXORA MD      │`);
      console.log(`│                     │`);
      console.log(`│      ${brand.signature}       │`);
      console.log(`│                     │`);
      console.log(`│ Successfully Online │`);
      console.log(`╰─────────────────────╯\n`);
      console.log(`🤖 Logged in as: ${sock.user?.name || 'Bot'} (${sock.user?.id?.split(':')[0]})\n`);

    } else if (connection === 'close') {
      const statusCode   = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || 'Unknown';
      console.log(`[CONNECTION DEBUG] Disconnect — statusCode: ${statusCode}, reason: ${errorMessage}, DisconnectReason.loggedOut=${DisconnectReason.loggedOut}`);

      // Determine whether this disconnect is recoverable
      const loggedOut          = statusCode === DisconnectReason.loggedOut;
      const connectionReplaced = statusCode === DisconnectReason.connectionReplaced;
      const badSession         = statusCode === DisconnectReason.badSession;

      if (loggedOut) {
        console.error('[CONNECTION] Session logged out by WhatsApp — clearing session and scheduling re-pair in 30s...');
        db.saveSync();
        // Auto-clear stale session so next attempt starts fresh
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

      if (reconnectAttempts < config.reconnectLimit) {
        reconnectAttempts++;
        const delay = getReconnectDelay(reconnectAttempts);
        console.log(`[CONNECTION] Reconnect attempt ${reconnectAttempts}/${config.reconnectLimit} in ${delay / 1000}s...`);
        setTimeout(connectToWhatsApp, delay);
      } else {
        console.error(`[CONNECTION] Max reconnect attempts (${config.reconnectLimit}) reached. Shutting down.`);
        db.saveSync();
        process.exit(1);
      }
    }
  });

  // ── Incoming messages ─────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    if (chatUpdate.type !== 'notify') return;
    for (const rawMessage of chatUpdate.messages) {
      try {
        await handleMessage(rawMessage, sock);
      } catch (err) {
        console.error('[HANDLER ERROR] Uncaught error in message handler:', err.message || err);
      }
    }
  });

  // ── Group participant events ───────────────────────────────────────────────
  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleGroupParticipantsUpdate(update, sock);
    } catch (err) {
      console.error('[HANDLER ERROR] Uncaught error in group handler:', err.message || err);
    }
  });

  // ── Anti-call ────────────────────────────────────────────────────────────
  // Toggled at runtime via the `.anticall` command (persisted through
  // db.getSettings()). Only acts on the initial 'offer' so we don't try to
  // reject a call that has already been answered/ended/timed out.
  sock.ev.on('call', async (calls) => {
    if (!db.getSettings().anticall) return;
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

  return sock;
}

export default connectToWhatsApp;
