import express from 'express';
import { connectToWhatsApp } from './src/core/connection.js';
import { client } from './src/core/client.js';
import { assetManager } from './src/assets/assetManager.js';
import brand from './config/brand.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Root HTML response to satisfy standard web preview rendering
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${brand.name} Core</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5);
          max-width: 500px;
          width: 90%;
        }
        h1 {
          color: #25d366;
          margin-bottom: 1rem;
          font-size: 2rem;
          font-weight: 700;
        }
        p {
          color: #94a3b8;
          font-size: 1.05rem;
          line-height: 1.6;
          margin: 0.5rem 0;
        }
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
      <div class="container" id="app">
        <h1>${brand.name}</h1>
        <p>${brand.description}</p>
        <p>Created by ${brand.creator} • Framework: ${brand.core}</p>
        <p><strong>Note:</strong> Check your AI Studio console logs to retrieve the QR scan code or pairing code.</p>
        <div class="status-badge">● Nexora Core Ready</div>
      </div>
    </body>
    </html>
  `);
});

// JSON Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    botActive: !!client.socket,
    botUser: client.socket?.user ? client.socket.user.id.split(':')[0] : null
  });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`╭─────────────────────╮`);
  console.log(`│      ${brand.name}      │`);
  console.log(`├─────────────────────┤`);
  console.log(`│ Developer: ${brand.creator}    │`);
  console.log(`│ Engine: Core Ready  │`);
  console.log(`│ Version: ${brand.version}      │`);
  console.log(`│ Status: Starting    │`);
  console.log(`╰─────────────────────╯`);
  console.log(`[INFO] Web listening server starting on port ${PORT}...`);
  
  try {
    // Phase 16: Initialize Smart Asset Management System
    await assetManager.init();

    // Phase 5: Dynamic Loading of Plugins
    await client.loadPlugins();
    
    // Phase 3: Start WhatsApp socket connection
    await connectToWhatsApp();
    
  } catch (err) {
    console.error('[CRITICAL] Startup failed:', err);
    process.exit(1);
  }
});
