# NEXORA MD

Next Generation WhatsApp Multi-Device Framework built on Baileys.

## Run & Operate

- `node server.js` — start the bot (runs Express server + connects to WhatsApp)
- `npm install` — install dependencies
- QR code or pairing code prints to the console on first run

## Stack

- Node.js (ESM), Express
- Baileys (WhatsApp multi-device)
- Gemini AI (`@google/genai`)
- pino (logging), qrcode-terminal, wa-sticker-formatter

## Where things live

- `server.js` — entry point; starts Express + loads plugins + connects WhatsApp
- `src/core/` — Baileys socket, connection, client, serializer, credits
- `src/plugins/` — all bot commands (~30 plugins)
- `src/handlers/` — message and group event handlers
- `src/ui/` — ASCII builder, theme manager, message formatter
- `src/greetings/`, `src/menu/`, `src/newsletter/`, `src/images/`, `src/media/` — feature modules
- `src/assets/` — AI asset generation and management
- `config/` — brand, owner, layout settings
- `database/` — JSON databases (assets, images, media, theme)
- `media/` — thumbnails and images
- `scripts/patch-libsignal.js` — postinstall patch for libsignal

## Architecture decisions

- All bot commands live in `src/plugins/` and are dynamically loaded at startup via `client.loadPlugins()`
- Session credentials stored in `session/` directory (gitignored)
- Pairing code vs QR code controlled by `config/index.js` (`pairing.enabled`)

## User preferences

_Populate as you build._

## Gotchas

- Set `GEMINI_API_KEY` secret for AI features
- On first run, check console logs for QR code to scan with WhatsApp
- To reset session, delete the `session/` directory and restart
