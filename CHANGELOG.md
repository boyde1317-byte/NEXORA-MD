# Changelog

All notable changes to **NEXORA MD** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Remaining menu restyle sweep (15 files): buttonsCard, contact,
  documentInteractive, eventMessage, listFallback, location, media,
  moonsonCard, nativeFlow, newsletter, orderMessage, payment, product,
  reaction, richCard. Same rules as the earlier four: the bot name
  renders via `brand.display` in titles, headers, footers and ad
  replies (a custom bot name stays plain, via the `displayName`
  guard); button and picker labels use small caps; full sentences
  use native italic markup. The shared navigation picker in
  buttonsCard is restyled once and carries to every menu that uses
  it. Kept plain on purpose: catalog/order/product-quote and
  newsletter metadata, vCard contact data, custom `.setfooter`
  footers, command names, counts and other data. `galaxyMenu` is
  intentionally untouched — its Moongod port aesthetic (own fancy
  font, glitch header) is a coherent theme, like the declined
  a2uiSurface; the plain-text menu template is untouched too.
  `config/brand.js` display comment updated to match (menus now
  render display variants through the guard).
- Command directory menu restyle (`src/menu/types/commandDirectory.js`):
  the bot name renders via `brand.display` in the body title and
  footer (a custom bot name stays plain); picker rows use small caps
  category labels instead of title case; the instruction sentence
  moves from small caps to native italic markup. Stat lines, card
  title/subtitle, picker button, quick actions and row descriptions
  are unchanged; the now-unused `titleize` import drops (`.help`
  still uses it).
- Carousel menu restyle (`src/menu/types/carousel.js`): the bot name
  renders via `brand.display` in the header, card footers, tier-2
  footer and tier-3 ad reply title (a custom bot name stays plain);
  the two instruction sentences move from small caps to native italic
  markup; category buttons use small caps labels instead of uppercase;
  the tier-3 ad reply body uses small caps labels. Card captions,
  command lists and the tier-2 title are unchanged.
- Bottom sheet menu restyle (`src/menu/types/bottomSheet.js`): the bot
  name renders via `brand.display` in the stat header, footer fallback,
  ad reply title, sheet option title and tier-2 header (a custom bot
  name stays plain); all sheet rows and tier-2 quick replies use small
  caps labels like the AI-Dynamic buttons. The custom footer from
  `.setfooter` is never styled, and stat rows, divider and ad reply
  body are unchanged.
- AI-Dynamic menu restyle (`src/menu/types/aiDynamic.js`): theme titles
  and the bot name render in bold sans via the shared font helper and
  `brand.display` (a custom bot name stays plain); theme names in the
  card footer and Theme badge use small caps like everywhere else.
  Section headers, buttons, stat rows and command names are unchanged.
  Drops the unused `divider` and `buildPillCopyButton` imports.
- Response voice mix in `src/nexora-messages.js`: italic voice for
  confirmations and notices, bold lead word for errors and access
  denials; markup-carrying templates and emoji-led lines stay plain.
  The long success line trims to "Mission accomplished."
- Owner-only commands wrapping the baileys `0.3.18-r22` socket surface:
  usernames (`.checkusername`, `.setusername`, `.finduser`), spam
  reporting (`.reportspam`, `.reportcontact`, `.reportgroup`,
  `.reportuser`, `.reportmessage`) and phone-number registration
  (`.regcode`, `.register`). `.reportgroup` and `.register` require the
  word `confirm`: a successful group report makes the bot leave the
  group, and registration replaces the session identity. Results render
  through AIRich (native table + follow-up pills) with a rich-response
  table card as fallback; the two confirm gates render as action cards
  with one-tap buttons. Usage and error replies stay plain.
- Styled brand display variants (`config/brand.js` `display`): bold-sans
  name, cursive signature, small-caps labels, italic sentences. Plain
  values stay canonical for the pairing page, sticker metadata, menus
  and logs; `.brand`, `.about`, `.credits` and `.version` render the
  display variants, with structured metadata (vCard, contact name,
  booking location) kept plain.

## [2.2.2] — 2026-11-16

Picks up baileys `0.3.18-r22`, which adds three protocol surfaces the fork had
always been missing. Nothing in the bot's own commands changes; the new
capability is available to plugins.

### Changed
- baileys dependency moved from `v0.3.18-r21` to `v0.3.18-r22`.

### Added
- Usernames: `sock.checkUsername`, `setUsername`, `deleteUsername`,
  `getMyUsername`, `getUsernameRecommendations`, `checkAndSetUsername`,
  `findUserByUsername` and `fetchContactUsernames`.
- Reporting: `sock.reportSpam`, `reportContact`, `reportGroup`, `reportUser`
  and `reportMessage`. Reporting tags are captured as messages arrive, so
  `reportSpam()` works on recent messages in a chat.
- Registration: `sock.requestRegistrationCode` and `sock.register` for
  phone-number signup, plus `getBanDetails` for ban-appeal status.

## [2.2.1] — 2026-11-16

The table rule in 2.2.0 was too broad: it also told the model to tabulate
"spec/feature questions about several things", which could push a person or a
place into a grid. The shape now has to match the task.

### Changed

- **Tables are for comparisons only** — the contract allows one when the user is
  comparing 2+ named options or explicitly asks for a table/breakdown, and says
  outright: never table a single subject (a person, place, company, one product,
  a story, an explanation or code). Having many attributes is not a comparison
- **New `profile` shape** — "who is X", "info on X", "tell me about X",
  "explain X", "history of X" get a titled bullet answer (3-5 facts plus one
  line of context) and an explicit no-table rule, with an instruction to say so
  plainly rather than invent facts about a subject it does not know
- The contract now says how to answer non-comparison tasks: person/topic →
  title + bullets, explanation → 2-3 short paragraphs, opinion/recommendation →
  2-4 sentences, enumerable facts → bullets
- `.aiformat` lists the `profile` shape and its example

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
