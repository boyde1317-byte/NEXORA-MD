# Changelog

All notable changes to **NEXORA MD** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0] — 2026-10-07

First official release. 219 commands across 14 categories, built on the pinned
Baileys fork `#v0.3.18-r6` with device-verified rich-message generators.

### Added

- **Rich-message engine** — native tables, article cards with LaTeX and inline
  images, carousels, copy-code buttons, list pickers, action cards with
  ad-reply banners, image galleries. Every rich surface ships a plain-text
  fallback (`NEXORA_RICH_RESPONSE=0` disables all of them in one env var)
- **Interactive menu system** — 14 menu types with tap-to-switch categories,
  command detail pages (usage, aliases, cooldown, copy button), smallcaps
  styling throughout
- **AI suite** — Groq-powered chat with conversation memory, vision model,
  AI rich replies (markdown/tables/code rendering), AI image generation with
  a Pollinations.ai fallback that works without a Gemini key
- **Economy & XP** — coins, daily rewards, streaks, shop, leaderboard,
  transfers, level-up announcements
- **Games** — word chain, riddles, trivia, tarot, and more with edit-based
  animations and reaction status
- **Fun commands** — hack, roast, pickup, vibe, cat/dog with per-command
  action buttons
- **Group management** — antilink, antitag, warn system, approval flow for
  request-style commands, per-group settings
- **Downloader suite** — YouTube, TikTok, Instagram, media with animated
  progress bars
- **Full plugin authoring guide** in the README — every field, the execute
  context, the `m` object surface, and the rich-message tier pattern, all
  verified against the source

### Fixed

- 5 critical fork dispatch mismatches (event, product, pollResult, richMedia,
  richCarousel) against the Baileys fork API
- LaTeX corruption in the AI system prompt (unescaped `\frac`, `\pm`, `\sqrt`
  inside a template literal)
- 7 broken commands repaired by adding free API providers; crypto price plugin
- 4 missing-var bugs, AI conversation context, downloader fallbacks
- Command stats, graceful shutdown, `sendTable`, message store
- Interactive buttons: decluttered over-buttoned commands, added buttons to
  bare ones; externalAdReply link previews optimized

### Security

- Pairing codes always DM'd, never printed to groups
- `.eval` owner-only and sandboxed; ban/warn/mute permission-gated
- Security hardening pass across the plugin surface
- Session files excluded from the repo

### Deployment

- Dockerfile, docker-compose.yml, and fly.toml included
- Railway one-flow deployment documented in the README

[2.0.0]: https://github.com/boyde1317-byte/NEXORA-MD/releases/tag/v2.0.0
