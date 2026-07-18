// ─── Load environment variables FIRST before any other imports ───────────────
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import express from 'express';
import { connectToWhatsApp } from './src/core/connection.js';
import { client } from './src/core/client.js';
import { assetManager } from './src/assets/assetManager.js';
import { db } from './src/database/db.js';
import brand from './config/brand.js';

const app = express();
const PORT = 3000;

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
let httpServer = null;

function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} received. Closing connections and saving state...`);

  // 1. Persist the database immediately
  try {
    db.saveSync();
    console.log('[SHUTDOWN] Database saved.');
  } catch (err) {
    console.error('[SHUTDOWN] Failed to save database:', err.message);
  }

  // 2. Tear down the Baileys socket if open
  try {
    if (client.socket) {
      client.socket.end(undefined);
      console.log('[SHUTDOWN] WhatsApp socket closed.');
    }
  } catch (_) {}

  // 3. Stop the HTTP server
  if (httpServer) {
    httpServer.close(() => {
      console.log('[SHUTDOWN] HTTP server closed. Goodbye.');
      process.exit(0);
    });
    // Force-kill if HTTP close takes too long
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── Global error safety nets ─────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception — saving DB then exiting:', err);
  // Save DB state then exit — running in an unknown state is dangerous
  try { db.saveSync(); } catch (_) {}
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Log but do NOT exit — unhandled rejections are often recoverable (e.g. network blips)
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});

// ─── Web Server ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${brand.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #0c0f12;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          background-color: #171d24;
          padding: 3rem;
          border-radius: 12px;
          border: 1px solid #2d3748;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
          max-width: 500px;
          width: 90%;
        }
        h1 { color: #25d366; margin-bottom: 1rem; font-size: 2rem; font-weight: 700; }
        p { color: #94a3b8; font-size: 1.05rem; line-height: 1.6; margin: 0.5rem 0; }
        .status-badge {
          display: inline-block;
          background-color: #1b2622;
          color: #10b981;
          padding: 0.4rem 1rem;
          border-radius: 50px;
          font-weight: 600;
          font-size: 0.9rem;
          border: 1px solid #065f46;
          margin-top: 1.5rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${brand.name}</h1>
        <p>${brand.description}</p>
        <p>Created by ${brand.creator} • Framework: ${brand.core}</p>
        <p><strong>Note:</strong> Check your server console logs to retrieve the pairing code or QR code.</p>
        <div class="status-badge">● Nexora Core Ready</div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    botActive: !!client.socket,
    botUser: client.socket?.user ? client.socket.user.id.split(':')[0] : null
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
httpServer = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`╭─────────────────────╮`);
  console.log(`│      ${brand.name}      │`);
  console.log(`├─────────────────────┤`);
  console.log(`│ Developer: ${brand.creator}    │`);
  console.log(`│ Engine: Core Ready  │`);
  console.log(`│ Version: ${brand.version}      │`);
  console.log(`│ Status: Starting    │`);
  console.log(`╰─────────────────────╯`);
  console.log(`[INFO] Web server listening on port ${PORT}...`);

  try {
    await assetManager.init();
    await client.loadPlugins();
    await connectToWhatsApp();
  } catch (err) {
    console.error('[CRITICAL] Startup failed:', err);
    process.exit(1);
  }
});
