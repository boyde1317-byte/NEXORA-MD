# Changelog

All notable changes to **NEXORA MD** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.0] — 2026-11-16

AI replies now use the rich renderer on purpose instead of by accident: the
model is told what WhatsApp can paint, and a comparison question is turned
into a native table instead of a paragraph.

### Added

- **Rich rendering contract** (`src/lib/aiRichFormat.js`) — appended to the AI
  system prompt whenever rich responses are on: one pipe table for comparisons
  (header names the row axis, 2-4 options, max 8 attribute rows, one short
  value per cell, closing `*Verdict:*` line), code in a single tagged fence,
  LaTeX for math, numbered steps, single-asterisk WhatsApp markup, no `#`
  headings. With `NEXORA_RICH_RESPONSE=0` the base prompt ships untouched
- **Per-turn shape detection** — `detectRichIntent()` reads the prompt and
  appends a hard directive only when it applies: "compare X vs Y", "difference
  between", "which is better", "pros and cons" → comparison; "table of" →
  table; "how do I" → steps. A poem or a summary gets no table nudge, so the
  model is never pushed into tabulating prose
- **`.aiformat`** — owner audit: current contract state, which shape a prompt
  maps to, and `test` / `table` / `code` / `math` to send canned AI-shaped
  replies through the real rich path without spending an API call
- Offline checks for the whole layer (10 new assertions in
  `scripts/verify-release.mjs`, 34 total): intent detection, contract gating,
  table parsing edge cases, the built `richResponseMessage` payload and the
  `GenATableUXPrimitive` in its decoded unified response

### Changed

- `aiTextGenerator` builds its system prompt per turn via
  `buildAISystemPrompt()` for chat, code, debug and brainstorm instead of
  sending the bare persona prompt
- `.debug`, `.vision` and `.proofread` now try the rich renderer first and keep
  their existing interactive card as the fallback

### Fixed

- A table-only AI reply used to be anchored with the text "Here is the code:";
  the lead-in now matches what is attached ("Here is the comparison:")
- `**double**` asterisks and `__double__` underscores are folded to WhatsApp
  markup for both paths — they previously reached the device as literal
  characters
- Tables the model emits now survive intact: escaped `\|` cells, tables with no
  outer pipes, `:---:` alignment rows, CRLF line endings, ragged rows padded to
  one width, header-only grids kept as text, and a table split by a blank line
  rejoined into one
- Over-wide or over-long tables are capped (6 columns, 12 rows) with a visible
  note instead of being silently truncated

## [2.1.0] — 2026-11-16

Upgrade release: the pinned fork moves to `#v0.3.18-r21` and NEXORA gains the
full A2UI v0.9 surface layer, plus an offline release gate.

### Added

- **A2UI v0.9 surfaces** (`src/lib/a2uiKit.js`) — the whole 18-component basic
  catalog: layout (`Row`, `Column`, `List`, `Card`, `Tabs`, `Modal`, `Divider`),
  content (`Text`, `Image`, `Icon`, `Video`, `AudioPlayer`), `Button` and the
  input set (`TextField`, `CheckBox`, `ChoicePicker`, `Slider`,
  `DateTimeInput`). Surfaces are composed locally and shipped in
  `InteractiveMessage.bloksWidget`; no Meta Flow or WABA involved
- **Pre-send validation** — every surface is checked against the catalog
  (required props, single `root`, no duplicate ids, no dangling child refs)
  before it leaves the process, with a plain-text fallback. An invalid surface
  used to reach the device and fail as an `A2UIValidationException` with no
  visible error
- **Menu style 20 `.setmenu 20` (`a2uiSurface`)** — native card with banner,
  live stats block and tabs for Categories / Top / Links, plus tap-to-open
  buttons for panel, channel and repo
- **`.testa2ui`** — owner audit: one card per catalog component, `check` to run
  the validation offline, `all` to sweep every surface, `list`, `catalog`
- **`scripts/verify-release.mjs`** (`npm test`) — 24 offline checks covering the
  pin, the A2UI layer, menu and plugin registries, capability flags, the
  crash-payload sanitizer and docs/version consistency
- **CI** (`.github/workflows/verify.yml`) — lint + release gate on node 20, 22
  and 24 for every push and PR

### Changed

- Baileys pin `#v0.3.18-r17` → `#v0.3.18-r21`; the stale lockfile that was
  actually installing r13 is fixed, so `npm ci` and `npm install` now agree
- `galaxyMenu`'s A2UI card is built with the fork's builders and validated via
  `attachA2ui` instead of hand-written proto nodes

### Fixed

- Six `ReferenceError` crashes on live commands: undefined crew chip in
  `.heist`, missing `sock` in `.alight` / `.ban` / `.unban`, and undefined
  `isGroupMsg` / `num` in the view-once rescue path
- `.newsletter` never loaded — a wrong relative import depth (`../../config`
  instead of `../../../config`) failed the whole plugin
- `.pull` was unreachable: the gacha plugin's `pull` alias shadowed the
  codebase downloader's canonical name. Gacha aliases are now `wish` / `summon`
- The LaTeX formatting rule in the AI system prompt was mangled by single
  backslashes (`\f` became a form feed); it now renders as intended
- ESLint: 20 errors → 0 (escape sequences, zero-width character class,
  misleading character class)

### Docs

- README: `r21` pin badge, A2UI feature blurb, `.testa2ui` row, v2.1.0 badge
- Brand version 2.1.0

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
