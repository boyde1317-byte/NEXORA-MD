<div align="center">

```
╭─────────────────────────────────────────────────────╮
│                                                     │
│          ███╗   ██╗███████╗██╗  ██╗ ██████╗ ██████╗ █████╗         │
│          ████╗  ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗        │
│          ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║██████╔╝███████║        │
│          ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║██╔══██║██╔══██║        │
│          ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║        │
│          ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝        │
│                                                     │
│          Next Generation WhatsApp Multi-Device Framework            │
│                       By Aizen • v1.1.0                             │
│                                                     │
╰─────────────────────────────────────────────────────╯
```

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Multi--Device-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.whatsapp.com)
[![Baileys](https://img.shields.io/badge/Baileys-Fork-FF6B35?style=for-the-badge)](https://github.com/boyde1317-byte/baileys)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.0-purple?style=for-the-badge)](package.json)

</div>

---

## ✨ What is NEXORA MD?

**NEXORA MD** is a premium, production-grade WhatsApp Multi-Device bot framework built on a custom Baileys fork. It combines a robust plugin architecture, 13 interactive menu presentation styles, AI-powered asset generation, advanced group management, and a fully modular design — deployable across Replit, Railway, Render, Pterodactyl, VPS, and Termux with zero code changes.

> **"Next Generation WhatsApp Multi-Device Framework"** — engineered for reliability, extensibility, and a polished user experience.

---

## 🚀 Feature Highlights

### 🧠 Nexora Core Engine
- **Multi-device Baileys** via a custom private fork with extended proto support
- **ESM-native** codebase (Node.js `import/export` throughout)
- **Plugin hot-reload** — reload all commands at runtime without restarting the process
- **Exponential reconnect backoff** — 5s → 10s → 20s → 40s → 60s cap, with smart detection of fatal vs. recoverable disconnects
- **Graceful shutdown** — SIGTERM/SIGINT save the database, drain the HTTP server, and close the WA socket cleanly before exit
- **Auto-save safety net** — database flushes every 60s even without explicit saves, preventing data loss on hard kills
- **Pairing code & QR code** — configurable per deployment; no phone scan required in headless environments
- **Bounded message cache** — max 500 messages per chat, max 2,000 tracked chats, preventing unbounded memory growth

### 🎨 Nexora Flow — Interactive Menu System
15 fully distinct menu presentation styles, auto-selected based on what the receiving WhatsApp client supports:

| # | Style | Description |
|---|-------|-------------|
| 1 | **Document Interactive** | Interactive card with image header + subtitle + embedded adReply + action buttons |
| 2 | **Payment** | Request Payment invoice card (business-account feature; auto-degrades on personal accounts) |
| 3 | **Event Message** | Native WA event invitation card with dynamic start time |
| 4 | **Native Flow** | Advanced interactive card with embedded ad-reply, URL links, clipboard copy, quick-reply |
| 5 | **Product** | Offer overlay card — limited_time_offer banner + image header + action buttons |
| 6 | **Carousel** | Swipeable category cards with emoji icons, command previews, and multi-button actions |
| 7 | **Newsletter** | Channel/newsletter-style broadcast card |
| 8 | **Location** | Interactive card with live location badge in reply bar |
| 9 | **Contact** | Interactive card with owner vCard contact badge in reply bar |
| 10 | **Media** | Rich media showcase with interactive card + embedded ad-reply + stat dashboard |
| 11 | **Reaction** | Emoji reaction showcase with live-edited inline menu |
| 12 | **AI Dynamic** | AI-generated dynamic dashboard with progress bars, command rankings, multi-section panels |
| 13 | **Bottom Sheet** | Bottom sheet modal with optionText + rich stat rows + embedded ad-reply fallback |
| 14 | **Order Message** | Interactive card + embedded ad-reply quoted inside a business order card |
| 15 | **Rich Card** | Rich response table grid + interactive card with embedded ad-reply overlay |

#### ✨ Rich-Messages Enhancement (v1.2.0+)
- **Full submessage support**: All 10 V1 submessage types (TEXT, TABLE, CODE, INLINE_IMAGE, GRID_IMAGE, DYNAMIC, MAP, LATEX, CONTENT_ITEMS) + structured metadata types (products, posts, suggested)
- **V2 generators**: 9 base64 unifiedResponse generators matching Meta AI's native format
- **LaTeX image rendering**: Default `mathjax-node` renderer (optional peer dep) for LaTeX→PNG
- **Rich message consumption**: `parseRichMessage()` decodes inbound V1 + V2 rich messages into readable text + structured sections
- **sendInteractive upgrades**: Menu types 1, 4, 10, 12, 13, 14 now use `sendInteractive` (full proto control) as their primary tier, enabling:
  - Image headers with **title AND subtitle** (not available in simple nativeFlow)
  - **Embedded externalAdReply** inside the interactive message — double visual: interactive card + ad banner in one message
  - Full nativeFlow buttons with `display_text` formatting
- **New menu style (15)**: Rich Card — uses the fork's `sendRichResponse` API for native WA table bubbles with aligned columns
- **Enhanced visual system**: Upgraded `asciiBuilder` with progress bars, stat rows, multi-section panels, dividers, and badges
- **Richer text menus**: Enhanced `menuTemplate` with per-category command counts, numbered sections, and themed footer
- **Enhanced system/profile templates**: Visual stat rows, health bars, and status badges
- **AI-Dynamic dashboard**: ASCII progress bars for system health/memory, multi-section box-drawing panels, 5 random themes, top-5 command rankings with visual bars
- **`baileysBridge.sendRichCard`**: New premium card builder combining image header + subtitle + embedded adReply + business badge + AI message support in one call
- **`!testrich` command**: 32-test interactive registry covering all V1/V2 generators, unit validation, and capture round-trips

- Automatic **capability detection** on startup — unsupported message types fall back gracefully to a styled text menu
- **Per-style image/audio** — custom background images and menu audio configurable per style
- **3 visual themes** — `modern`, `classic`, `minimal` with distinct border characters and layouts
- Persistent **active menu** and **active theme** stored in the database

### 🤖 Nexora Intelligence — AI Asset Generation
- Integrates with **Google Gemini** for on-demand image generation
- Generates bot assets (menu banners, welcome/goodbye cards) automatically on first boot
- `!generateimage <prompt>` lets the owner create custom images on the fly
- `!generateassets` regenerates all system assets without restarting

### 👥 Group Management
- **Welcome & Goodbye cards** with 3 selectable styles:
  - *Style 1* — Full-bleed image with externalAdReply banner and profile picture overlay
  - *Style 2* — Document card with virtual PDF header
  - *Style 3* — Interactive message card
- Custom welcome/goodbye text with live placeholders (`{user}`, `{group}`, `{memberCount}`)
- Custom welcome/goodbye background images (local path or URL)
- **Milestone alerts** — automatic congratulations when a group hits 10, 50, 100, 500 members
- One-command group admin promotion/demotion
- Tag all group members with a single command
- Sequential join/leave queue prevents race conditions during rapid mass joins

### 🗃️ Nexora Guard — Data & Permissions
- **Flat-file JSON database** — zero external dependencies; persists users, groups, and settings
- **Atomic writes** — temp-file + rename ensures no partial writes corrupt the database
- **Automatic backup** — `.bak` file maintained alongside the primary database
- **Auto-save safety net** — flushes to disk every 60s even without explicit triggers
- **Ban system** — banned users are silently blocked from all commands
- **Owner-only mode / public mode** — toggle with a single config flag
- **Per-command permission levels**: `owner`, `groupOnly`, `admin` (sender), `botAdmin` (bot itself)
- **Cooldown enforcement** — per-user, per-command; configurable globally and per plugin
- Crash-safe: `uncaughtException` saves the database before exiting

### 🎛️ Customisation
- 3 built-in themes; owners can create and register fully custom border themes
- 5 footer styles (`clean`, `minimal`, `professional`, `ornate`, `default`)
- Menu audio enable/disable; custom audio file per deployment
- Asset image mode: `static`, `random`, or `rotate`
- All settings persisted in the database and changeable at runtime — no restarts needed

---

## 📋 Command Reference

Commands work with any of the configured prefixes: `!`, `.`, `/`

### 🌐 General Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `!menu` | — | Open the premium interactive command console in your active style |
| `!menulist` | — | List all available menu styles with compatibility status |
| `!ping` | — | Check bot response latency |
| `!about` | — | Bot branding, credits, and system info |
| `!version` | — | Bot, core, and Node.js runtime versions |
| `!poll <question> / opt1, opt2` | — | Create an interactive WhatsApp poll |
| `!event <name>` | — | Generate a WhatsApp event invite card |
| `!channel` | — | View or manage newsletter/channel info |

### 👑 Owner Commands

| Command | Description |
|---------|-------------|
| `!setmenu <1–13>` | Switch the active menu presentation style |
| `!settheme <modern\|classic\|minimal>` | Switch the global UI theme |
| `!createtheme <name>` | Register a new custom border theme |
| `!setfooter <style>` | Change the message footer style |
| `!setmenuimage` | Save a replied image as the current menu's background |
| `!setmenuaudio <on\|off>` | Toggle menu background audio |
| `!setthumbnail <on\|off>` | Toggle menu thumbnail images |
| `!setmenumedia` | Ingest audio/image/thumbnail files into the menu system |
| `!setimagemode <static\|random\|rotate>` | Control how menu images are selected |
| `!welcome <on\|off>` | Toggle global welcome messages |
| `!goodbye <on\|off>` | Toggle global goodbye messages |
| `!setwelcome <1\|2\|3>` | Set welcome card presentation style |
| `!setwelcometext <text>` | Set custom welcome text (supports `{user}`, `{group}`, `{memberCount}`) |
| `!setgoodbyetext <text>` | Set custom goodbye text |
| `!setwelcomeimage` | Set custom welcome card background (reply to image or send URL) |
| `!setchannel <jid>` | Set the bot's official WhatsApp channel JID |
| `!generateimage <prompt>` | Generate an AI image via Gemini |
| `!generateassets` | Regenerate all AI bot assets |
| `!restart` | Hot-reload all plugins (or `!restart hard` for full process restart) |
| `!testmessage` | Test experimental UI message types with capability feedback |
| `!eval <code>` | Execute arbitrary JavaScript on the bot process (owner only) |

### 👥 Group Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `!tagall [message]` | `!everyone`, `!all`, `!announce` | Mention all group members |
| `!kick @user` | — | Remove a participant from the group |
| `!promote @user` | — | Promote a member to group admin |
| `!demote @user` | — | Demote an admin to regular member |

### 🎬 Media Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `!sticker` | `!s`, `!wm`, `!pack` | Convert a replied/sent image or video into a WhatsApp sticker |
| `!download` | — | Download and re-send media from a replied message; bypasses view-once |

---

## 🛠️ Installation

### Prerequisites
- **Node.js 20+** (check: `node --version`)
- **npm 8+** (check: `npm --version`)
- A **WhatsApp account** to link as the bot number

### Clone & Install

```bash
git clone https://github.com/boyde1317-byte/NEXORA-MD.git
cd NEXORA-MD
npm install
```

> **Note:** `npm install` runs a `postinstall` script (`scripts/patch-libsignal.js`) that patches `@adiwajshing/libsignal` for multi-device compatibility. This is automatic.

### Configure

All sensitive configuration is done via environment variables. Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Your phone number(s) — comma-separated, country code, no + or spaces
OWNER_NUMBERS="447911123456"
PAIRING_PHONE="447911123456"

# Bot owner display name
OWNER_NAME="YourName"

# AI (optional — enables image generation)
GEMINI_API_KEY="your_gemini_api_key"
```

Configure your bot identity in `config/brand.js`:

```js
export default {
  name: "NEXORA MD",
  creator: "YourName",
  version: "1.1.0",
  description: "Your bot description",
};
```

Adjust command settings in `config/index.js` (prefix, mode, etc.).

### Start

```bash
npm start
```

On first run the bot will print a **pairing code** to the console:

```
🔑 WHATSAPP PAIRING CODE: XXXXXXXX
👉 Go to WhatsApp → Settings → Linked Devices → Link a Device
   Then tap "Link with phone number instead" and enter the code above.
```

Once linked, the session is saved to `./session/` and the bot reconnects automatically on restart.

---

## ☁️ Deployment Guides

### Replit

1. Fork or import this repo into your Replit workspace.
2. Add `GEMINI_API_KEY`, `OWNER_NUMBERS`, and `PAIRING_PHONE` to **Secrets**.
3. The configured workflow (`node server.js`) starts automatically.
4. The web preview serves a status page at `/`; health endpoint at `/api/health`.

### Railway / Render

1. Connect your GitHub repo.
2. Set the start command to `npm start`.
3. Add environment variables: `OWNER_NUMBERS`, `PAIRING_PHONE`, `GEMINI_API_KEY` (optional), `GENERATE_ASSETS=false`.
4. Set `NODE_ENV=production` for optimized caching.
5. **Session note:** Railway/Render use ephemeral filesystems — the `session/` directory is wiped on every redeploy. Re-pair after each deploy, or mount a persistent disk and point `sessionPath` in `config/index.js` to it.

### Docker

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your OWNER_NUMBERS, PAIRING_PHONE, etc.

# Build and run
docker compose up -d

# Check health
curl http://localhost:3000/api/health

# View logs
docker compose logs -f nexora-md
```

The Dockerfile runs as a non-root user with a built-in health check. Session data and database are persisted via Docker volumes.

### Pterodactyl

1. Use a **Node.js egg** with startup command `npm start`.
2. Set the install command to `npm install`.
3. The bot handles SIGTERM gracefully — server restarts won't corrupt the database.
4. Allocate at least **512 MB RAM** and **1 CPU** for stable operation.

### VPS (Ubuntu/Debian)

```bash
# Install Node.js 20 via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20

# Install PM2 for process management
npm install -g pm2

# Start the bot
cd NEXORA-MD
npm install
pm2 start server.js --name nexora-md
pm2 save
pm2 startup
```

### Termux (Android)

```bash
pkg update && pkg upgrade
pkg install nodejs git
git clone https://github.com/boyde1317-byte/NEXORA-MD.git
cd NEXORA-MD
npm install
npm start
```

> Keep the Termux session alive with `termux-wake-lock` or run inside `screen`/`tmux`.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OWNER_NUMBERS` | **Yes** | — | Comma-separated owner phone numbers (country code, no +) |
| `PAIRING_PHONE` | **Yes** | — | Phone number for WhatsApp pairing code |
| `OWNER_NAME` | Optional | `Bot Owner` | Owner display name |
| `GEMINI_API_KEY` | Optional | — | Enables AI image generation and asset creation |
| `GENERATE_ASSETS` | Optional | `false` | Set to `true` to generate AI assets on startup |
| `CHANNEL_JID` | Optional | — | WhatsApp channel JID for newsletter menu type |
| `PORT` | Optional | `3000` | Web server port (auto-set on Railway/Render/Replit) |
| `NODE_ENV` | Optional | — | Set to `production` for optimized caching |

---

## 🏗️ Project Architecture

```
NEXORA-MD/
├── config/
│   ├── index.js         # Core settings (owner, prefix, pairing, mode)
│   ├── brand.js         # Bot identity (name, creator, version)
│   ├── owner.js         # Extended owner settings
│   └── layout.js        # Theme border configurations
│
├── src/
│   ├── core/
│   │   ├── connection.js      # Baileys socket, pairing, reconnect logic
│   │   ├── client.js          # Plugin loader with diagnostics
│   │   ├── serializer.js      # Raw Baileys → rich message object
│   │   ├── baileysBridge.js   # Interactive messages, rich message gen + consumption
│   │   ├── capabilities.js    # Proto feature detection at startup
│   │   ├── footer.js          # Footer style manager
│   │   └── credits.js         # Credit/brand helpers
│   │
│   ├── handlers/
│   │   ├── message.js         # Full command dispatch pipeline
│   │   └── group.js           # Welcome/goodbye event handler
│   │
│   ├── plugins/               # 35+ command modules (one file per command)
│   │
│   ├── menu/
│   │   ├── index.js           # Registers all 13 menu renderers
│   │   ├── manager.js         # Active menu persistence
│   │   ├── collector.js       # Gathers live bot stats for menus
│   │   ├── formatter.js       # Text/compact menu builders
│   │   ├── fallback.js        # Renderer error → text fallback
│   │   └── types/             # 13 individual menu type renderers
│   │
│   ├── greetings/
│   │   ├── greetingManager.js   # Join/leave/promo/demotion entry points
│   │   ├── greetingRenderer.js  # Sequential queue renderer
│   │   ├── greetingConfig.js    # Greeting settings (DB-backed)
│   │   ├── greetingBuilder.js   # Text template engine
│   │   ├── messageCapability.js # Message type feature flags
│   │   └── greetingStyles/      # welcome1.js, welcome2.js, welcome3.js
│   │
│   ├── assets/
│   │   ├── assetManager.js      # Priority resolver (manual→AI→default→URL)
│   │   ├── aiAssetGenerator.js  # Gemini image generation
│   │   ├── defaultAssets.js     # BMP fallback generation
│   │   └── assetValidator.js    # Magic-byte image validation
│   │
│   ├── database/
│   │   └── db.js                # Synchronous JSON flat-file database
│   │
│   ├── ui/
│   │   ├── messageFormatter.js  # success/error/warn/info/loading templates
│   │   ├── themeManager.js      # Active theme read/write
│   │   ├── asciiBuilder.js      # Box/list/card ASCII builders
│   │   └── templates/           # Per-context message templates
│   │
│   └── media/
│       ├── mediaManager.js      # Async outbound media queue
│       ├── mediaBuilder.js      # File → Baileys payload builders
│       └── mediaConfig.js       # Media settings (DB-backed)
│
├── server.js            # Express entry point, graceful shutdown, startup
├── package.json
├── .env.example
└── session/             # Baileys auth state (gitignored)
```

---

## 🔌 Writing a Plugin

Every command is a single `.js` file in `src/plugins/`. The minimum shape:

```js
// src/plugins/greet.js
export default {
  name: 'greet',                    // trigger: !greet
  aliases: ['hello', 'hi'],         // also: !hello, !hi
  category: 'general',
  description: 'Sends a greeting.',
  cooldown: 2000,                   // ms; overrides global default
  permissions: {
    owner: false,                   // set true to restrict to owner
    groupOnly: false,               // set true for groups only
    admin: false,                   // require sender to be group admin
    botAdmin: false                 // require bot to be group admin
  },

  execute: async ({ m, args, prefix, sock, db, config }) => {
    const name = args[0] || 'friend';
    await m.reply(`👋 Hello, ${name}!`);
  }
};
```

Drop the file into `src/plugins/` and run `!restart` — no process restart needed. The plugin loader validates `name` and `execute` and reports failures in the startup summary.

### Context object

The `execute` function receives:

| Key | Type | Description |
|-----|------|-------------|
| `m` | Object | Serialized message with `.reply()`, `.react()`, `.edit()`, `.delete()`, `.download()` |
| `m.reply` | Function | Sends a quoted text reply; also `.reply.success/error/warn/info/loading()` |
| `m.quoted` | Object | Quoted message (if any) with its own `.download()` |
| `args` | `string[]` | Command arguments split by whitespace |
| `prefix` | `string` | The prefix character that triggered this command |
| `sock` | Object | Raw Baileys socket for advanced send operations |
| `db` | Object | Database (`getUser`, `setUser`, `getGroup`, `setGroup`) |
| `config` | Object | Bot configuration |
| `client` | Object | Plugin registry and `client.socket` |
| `isOwner` | `boolean` | Whether the sender is the bot owner |
| `isGroup` | `boolean` | Whether the message is from a group |

---

## 🎨 Customising Welcome Messages

```
# Enable welcomes globally
!welcome on

# Choose the card style
!setwelcome 1    ← Image card with banner
!setwelcome 2    ← Document PDF card
!setwelcome 3    ← Interactive button card

# Set custom text (placeholders: {user}, {group}, {memberCount})
!setwelcometext Welcome {user} to *{group}*! You are member #{memberCount} 🎉

# Set a custom background (reply to an image, or send a URL)
!setwelcomeimage
```

---

## 🧩 Supported Message Types (Serializer)

The serializer correctly extracts command text from:

| Type | Source |
|------|--------|
| `conversation` | Plain text messages |
| `extendedTextMessage` | Formatted text, links, mentions |
| `imageMessage` | Image captions |
| `videoMessage` | Video captions |
| `documentMessage` | Document captions |
| `documentWithCaptionMessage` | Captioned document wrapper |
| `ephemeralMessage` | Disappearing messages (unwrapped) |
| `viewOnceMessage` / `v2` | View-once messages (unwrapped) |
| `buttonsResponseMessage` | Button tap responses |
| `listResponseMessage` | List row selections |
| `templateButtonReplyMessage` | Template button replies |
| `interactiveResponseMessage` | Native-flow button responses |
| `botForwardedMessage` | Rich messages from Meta AI / NEXORA generators (V1 + V2 parsed) |
| `stickerPackMessage` | Sticker pack name (fork addition) |
| `lottieStickerMessage` | Animated stickers (fork addition) |
| `pollResultSnapshotMessage` | Poll result question text (fork addition) |
| `groupStatusMessageV2` | Group status wrapper (unwrapped, fork addition) |
| `spoilerMessage` | Spoiler wrapper (unwrapped, fork addition) |

---

## 🎨 Rich Message System

NEXORA-MD fully supports the Baileys fork's rich message system — both
**generating** outbound rich messages and **consuming** inbound ones.

### Generation (Outbound)

`baileysBridge.sendRichResponse()` sends rich content via the fork's
`prepareRichResponseMessage` pipeline. All submessage types are supported:

| Submessage | Key | Example |
|------------|-----|---------|
| Text | `{ text: '...' }` | Plain text bubble |
| Table | `{ table: { title, rows: [{ items: [...] }] } }` | Aligned-column table |
| Code | `{ code: [{ codeContent: '...' }], language: 'js' }` | Syntax code block |
| Inline Image | `{ inlineImage: { imageHighResUrl, ... }, imageText: '...' }` | Image with caption |
| Grid Image | `{ gridImage: { gridImageUrl, imageUrls: [...] } }` | Image gallery grid |
| Dynamic | `{ dynamic: { type: 2, url: '...' } }` | Animated GIF/image |
| Map | `{ map: { centerLatitude, centerLongitude, annotations } }` | Location card |
| LaTeX | `{ latex: { text, expressions: [{ latexExpression }] } }` | LaTeX rendering |
| Reel | `{ reels: [{ title, videoUrl, ... }] }` | Video carousel |
| Links | `{ links: [{ title, url }], text: '...' }` | Citation link collection |
| Products | `{ products: { title, items: [{ title, price }] } }` | Product metadata |
| Posts | `{ posts: { items: [{ title, url }] } }` | Social post metadata |
| Suggested | `{ suggested: { items: [{ title }] } }` | Suggested prompt metadata |

If the proto relay fails, `sendRichResponse` falls back to formatted plain text
for every submessage type listed above.

### Consumption (Inbound)

`baileysBridge.parseRichMessage()` decodes incoming `botForwardedMessage`
rich messages into a structured `{ isRich, text, type, sections }` result:

- **V1 submessages**: iterates `richResponseMessage.submessages` and formats
  each by `messageType` (GRID_IMAGE=1, TEXT=2, INLINE_IMAGE=3, TABLE=4,
  CODE=5, DYNAMIC=6, MAP=7, LATEX=8, CONTENT_ITEMS=9)
- **V2 unifiedResponse**: decodes the base64 `unifiedResponse.data` JSON
  and formats each `view_model.primitive` by `__typename`

The serializer's `extractBody` calls `parseRichMessage` for
`botForwardedMessage` types, so incoming rich messages are available as
`message.body` just like any other message type.

### Test Suite

Run `!testrich` (owner-only) to access the interactive rich message test
registry — 32 tests across 10 groups covering V1, V2, links, unit
validation, and capture round-trips for every submessage type.

---

## 📡 Health & Status

The bot exposes two HTTP endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /` | HTML status page with bot branding |
| `GET /api/health` | JSON: `{ status, uptime, botActive, botConnected, memory, pluginsLoaded }` |

The health endpoint includes memory usage (RSS, heap used, heap total) and plugin count for monitoring — useful for spotting memory leaks and misconfigured deployments.

---

## 🛡️ Security Notes

- **Owner numbers are env-only** — `OWNER_NUMBERS` must be set in `.env`. No hardcoded phone numbers in source code.
- **Sandboxed eval** — the `!eval` command runs in a `vm.Context` with a 10s timeout and only non-secret env vars exposed. It is hard-restricted to the owner number(s).
- **Session files** in `session/` contain your WhatsApp credentials. Keep them private — `session/` is in `.gitignore`.
- **API keys** (`GEMINI_API_KEY`) should always be set as environment variables — never hardcoded in config files.
- **SSRF protection** — all outbound HTTP requests (downloader, web plugins) block private/loopback/metadata IPs.
- **Rate limiting** — the Express server applies rate limits to all API routes and a stricter limit to the health endpoint.

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `baileys` (fork) | WhatsApp Multi-Device protocol |
| `express` | Web server / health endpoint |
| `helmet` | HTTP security headers |
| `express-rate-limit` | API rate limiting |
| `dotenv` | Environment variable loading |
| `wa-sticker-formatter` | Sticker creation from image/video |
| `qrcode-terminal` | QR code display in headless terminals |
| `pino` | Silent structured logger for Baileys |
| `sharp` | Image processing |
| `@google/genai` | Gemini AI image generation |

---

## 🤝 Credits

```
╭─────────────────────────────────╮
│          NEXORA MD              │
│                                 │
│  Developer  : Aizen             │
│  Framework  : Nexora Core       │
│  Engine     : Nexora Engine     │
│  UI Layer   : Nexora Flow       │
│  Plugins    : Nexora Modules    │
│  Security   : Nexora Guard      │
│  AI Layer   : Nexora Intelligence│
│                                 │
│  Version    : 1.1.0             │
│  Signature  : By Aizen          │
╰─────────────────────────────────╯
```

Built on top of the [Baileys](https://github.com/WhiskeySockets/Baileys) WhatsApp Web API library.

---

## 📬 Connect with the Developer

<div align="center">

**Aizen** — Creator & Lead Developer of NEXORA MD

| Platform | Link |
|----------|------|
| 💬 WhatsApp | [wa.me/233533416608](https://wa.me/233533416608) |
| ✈️ Telegram | [@DeathCore_Xr](https://t.me/DeathCore_Xr) |
| 📢 WhatsApp Channel | [Join for updates & announcements](https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326) |

> Star ⭐ the repo if you find it useful. For bugs, feature requests, or forks — reach out via WhatsApp or Telegram.

</div>

---

<div align="center">

**© NEXORA MD — By Aizen**

[![WhatsApp](https://img.shields.io/badge/WhatsApp-Contact-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://wa.me/233533416608)
[![Telegram](https://img.shields.io/badge/Telegram-@DeathCore__Xr-2CA5E0?style=flat-square&logo=telegram&logoColor=white)](https://t.me/DeathCore_Xr)
[![Channel](https://img.shields.io/badge/WA%20Channel-Updates-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326)

*Use responsibly. This project is not affiliated with or endorsed by WhatsApp Inc.*

</div>
