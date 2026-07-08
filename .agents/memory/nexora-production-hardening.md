---
name: Nexora-MD production hardening
description: Deployment decisions made during the production audit for multi-platform support
---

## Key Decisions

**dotenv loading** — `dotenv.config()` must be the very first import in `server.js`, before any other module. Lazy loading in child modules (like aiAssetGenerator) means env vars aren't available at startup on Termux/local.

**Graceful shutdown** — SIGTERM/SIGINT must: (1) save db.json, (2) call `sock.end()` on the Baileys socket, (3) close the HTTP server with `.close()`, and (4) force-kill after a 5s timeout. Using `process.exit(0)` directly skips HTTP drain.

**uncaughtException treatment** — Should save DB then `process.exit(1)`. Do NOT continue running after uncaught exception — the process is in an unknown state. `unhandledRejection` is different: log only, do not exit (network blips etc. are recoverable).

**Baileys reconnect** — Exponential backoff: 5s → 10s → 20s → 40s → 60s cap. Fatal disconnect codes (loggedOut=401, connectionReplaced=440, badSession) must call `process.exit(1)` immediately without retrying.

**getMessage handler** — Always pass `getMessage: async () => ({ conversation: '' })` in socket options. Required for message retry/decryption on some WA versions; omitting it causes silent decryption failures.

**Session persistence** — On Railway/Render ephemeral filesystems the `session/` dir is wiped on redeploy. User must re-pair after every deploy. Document this in startup logs.

**Plugin loader** — Validates that each plugin has a string `name` and a function `execute` before registering. Tracks failures with reasons. Prints summary: Total / Successful / Failed. Cache-busts with `?t=Date.now()` for hot-reload support.

**Sticker author** — Must use `brand.creator` from `config/brand.js`, never hardcoded strings.

**package.json `dev` script** — Replaced `tsx` (devDependency) with `node --watch` (built-in Node 18+) to avoid tsx not being available in production installs.
