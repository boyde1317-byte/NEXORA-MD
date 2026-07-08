import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  makeCacheableSignalKeyStore 
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
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'silent' });

let reconnectAttempts = 0;

export async function connectToWhatsApp() {
  console.log('Initializing connection with WhatsApp multi-device...');
  
  // Ensure session directory exists
  const sessionDir = path.resolve(config.sessionPath);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: !config.pairing.enabled,
    browser: ['Ubuntu', 'Chrome', '20.0.0'],
    markOnlineOnConnect: true,
  });

  client.socket = sock;

  // Handle pairing code registration if enabled and not already logged in
  if (config.pairing.enabled && !sock.authState.creds.me) {
    if (!config.pairing.phoneNumber) {
      console.error('[ERROR] Pairing code enabled but no phoneNumber provided in config/index.js');
    } else {
      setTimeout(async () => {
        try {
          const cleanPhone = config.pairing.phoneNumber.replace(/[^0-9]/g, '');
          console.log(`[INFO] Requesting pairing code for phone number: ${cleanPhone}`);
          const code = await sock.requestPairingCode(cleanPhone);
          console.log(`\n==================================================`);
          console.log(`🔑 WHATSAPP PAIRING CODE: ${code}`);
          console.log(`👉 Enter this code on your WhatsApp companion device.`);
          console.log(`==================================================\n`);
        } catch (err) {
          console.error('[ERROR] Failed to request pairing code from WhatsApp:', err);
        }
      }, 5000); // Wait 5 seconds for socket connection to initialize
    }
  }

  // Bind auth credentials save trigger
  sock.ev.on('creds.update', saveCreds);

  // Monitor socket connection states
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !config.pairing.enabled) {
      console.log('[INFO] Scan this QR code to connect to WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'connecting') {
      console.log('[INFO] Connecting to WhatsApp servers...');
    } else if (connection === 'open') {
      console.log(`\n╭─────────────────────╮`);
      console.log(`│      NEXORA MD      │`);
      console.log(`│                     │`);
      console.log(`│      ${brand.signature}       │`);
      console.log(`│                     │`);
      console.log(`│ Successfully Online │`);
      console.log(`╰─────────────────────╯\n`);
      console.log(`🤖 Logged in as: ${sock.user.name || 'Bot'} (${sock.user.id.split(':')[0]})\n`);
      reconnectAttempts = 0; // Reset connection counter
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[WARN] Connection closed (Reason Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        if (reconnectAttempts < config.reconnectLimit) {
          reconnectAttempts++;
          console.log(`[RETRY] Reconnect attempt ${reconnectAttempts}/${config.reconnectLimit} starting in 5s...`);
          setTimeout(connectToWhatsApp, 5000);
        } else {
          console.error(`[CRITICAL] Max reconnection attempts (${config.reconnectLimit}) reached. Bot shutting down.`);
          db.save();
          process.exit(1);
        }
      } else {
        console.error('[CRITICAL] Session logged out. Please clear session directory and pair again.');
        db.save();
        process.exit(1);
      }
    }
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      // type can be 'notify' (new incoming) or 'append' (history load)
      if (chatUpdate.type === 'notify') {
        for (const rawMessage of chatUpdate.messages) {
          await handleMessage(rawMessage, sock);
        }
      }
    } catch (err) {
      console.error('[ERROR] Error processing messages upsert event:', err);
    }
  });

  // Handle group participants update (welcome/goodbye)
  sock.ev.on('group-participants.update', async (update) => {
    try {
      await handleGroupParticipantsUpdate(update, sock);
    } catch (err) {
      console.error('[ERROR] Error processing group participants update event:', err);
    }
  });

  return sock;
}

export default connectToWhatsApp;
