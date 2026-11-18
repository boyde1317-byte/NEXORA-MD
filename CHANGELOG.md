# Changelog

All notable changes to **NEXORA MD** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Menu 14 (orderMessage) now quotes its `buildFakeOrderQuote` card on every
  tier, as its header documents — the built quote was previously never used.
- Menu 7 (newsletter) now quotes its `buildFakeNewsletterQuote` card on every
  tier, as its header documents — tiers 1, 3 and 4 previously quoted the audio
  quote or an image quote.
- Menu 20 (product) now quotes a productMessage card built by
  `buildFakeProductQuote` (same catalog-quote shape as buttonsCard: bot name,
  brand description, thumbnail) on every tier, instead of the audio quote or
  an image quote.
- The five card styles (20 product, 14 order, 9 contact, 8 location, 7
  newsletter) no longer lose the whole menu when the banner image cannot be
  fetched: `imageManager.getMenuImage()` is guarded in each, so a CDN failure
  degrades to a text-only card instead of throwing out of the renderer. A new
  check renders all five against a stub socket and asserts each one rides on its
  own card (`productMessage`, `orderMessage`, `contactMessage`,
  `liveLocationMessage`, `newsletterAdminInviteMessage`).
- The card styles now send their own card as a **separate message before** the
  interactive list: contact → `contactMessage`, location → `locationMessage`,
  order → `orderMessage`, product → `productMessage`. The quoted card alone was
  invisible (WhatsApp renders no card preview inside a quote), which is why all
  of them still read as the same pill list on a phone. New bridge senders
  `sendContactCard`, `sendLocationCard` and `sendOrderCard` wrap the fork's
  `contacts` / `location` / `orderText` keys; product reuses `sendProduct`, which
  also stopped turning a `price: 0` into a $1.00 card. Newsletter still needs a
  `channelJid` before it can send its invite.
- Card styles now actually ride on their cards. The waUtils builders were never
  the problem: `.enrich` sends `m.reply(text, { quoted: buildFakeOrderQuote() })`
  and every strip renders, because WhatsApp draws the reply bar from
  `contextInfo.quotedMessage` and does not need a resolvable stanza. The bug was
  `baileysBridge.sendButtonsCard`: it builds the message by hand and relays it,
  so `options.quoted` never reached the wire and contact, order and location lost
  their card silently. New `buildQuotedContextInfo()` folds the builder's key and
  message into `stanzaId` / `participant` / `remoteJid` / `quotedMessage`, the same
  shape `enrichContext.js` uses, so those styles now quote their own card.
  Product already worked through `sendNativeFlow`, which forwards `quoted`.
- The five card menus now send an `interactiveMessage` with CTA rows instead of
  the `buttonsMessage` pill row. `product`, `contact`, `location`, `orderMessage`
  and `newsletter` all send through the new `baileysBridge.sendCtaCard()`, which
  builds body + footer + titled media header and maps each button to `cta_url`,
  `cta_copy`, `cta_call` or `quick_reply` — the CTA layout WhatsApp draws as
  full-width action rows. It accepts pre-built CTA buttons or the old
  `{ text, url | copy | id }` shape, so the styles only had to change sender.
  `sendInteractive` now folds `options.quoted` into `interactiveMessage.contextInfo`,
  so the quoted card strip survives this path too.
- Removed the leftover leading card message from those styles: the quote strip
  already carries the card, so sending it twice just repeated it.
- 15 Akoya-engine games ported in, as one runtime plus configs: `.game` now lists
  22 payloads (dino, chess, mbim, plane, ttc, calc, monitor plus racing, arrow,
  sonic, stickman, geometry, flappy, snake, snake-rimba, tetris, mahjong,
  memory-match, puzzle, angrybirds, mortal, tebakangka). The upstream ships 15
  near-identical ~30 KB documents, each the same 28.6 KB engine with a different
  `window.__GAME` block, so the engine is vendored once (`akoya-runtime.html`)
  and rendered per game from `akoya-games.json`: ~31 KB of source instead of
  ~450 KB, and 10 real mechanics (dodge, runner, snake, pairs, flap, tetrix,
  slide, guess, sling, duel). Accent colours are now applied in the canvas too,
  which the upstream only did in CSS. Both files are pinned in SOURCES.json with
  the private Akoya-MD commit they came from, and a release check fails on an
  unfilled placeholder, an unknown mechanic, or any network call in a payload.
- Menu 21's DM row prints the owner's WhatsApp username (`wa.me/@moonson3`)
  instead of the phone number, so the card no longer exposes the number. The
  username lives in `config/owner.js` as `ownerUsername` (env `OWNER_USERNAME`,
  default `moonson3`), and the release check fails if the card prints a numeric
  wa.me link again.
- Every menu style now paints its copy grey, menu 21's way. The menu text moves
  out of `interactiveMessage`/`buttonsMessage` body into `footer.text`, which
  WhatsApp renders small and grey, and the body carries a single zero-width space
  so the bubble keeps its size. Long footers were verified on device to render in
  full, so nothing is trimmed.
  - New `src/lib/dimCard.js` (`greyCopy`, `DIM_BODY`): moves copy into the footer,
    keeping any existing footer line below it.
  - `sendInteractive`, `sendCtaCard`, `sendNativeFlow`, `sendButtonsCard` and
    `sendCarousel` accept `dim: true` and do the move themselves, so a style only
    passes the flag. a2uiSurface, commandDirectory and moonsonCard build their own
    proto and call `greyCopy()` directly.
  - Opted in: a2uiSurface, bottomSheet, buttonsCard, carousel, commandDirectory,
    contact, documentInteractive, location, moonsonCard, nativeFlow, newsletter,
    orderMessage, product, richCard. atlasMenu and galaxyMenu already did it.
  - New release check fails any menu style that puts its copy back in the body.
  - commandDirectory's fallback was still sending the full list as an image
    caption; it is now a grey CTA card like the rest, with the image caption kept
    only as the last-resort path.
- `a2uiSurface` now claims id 16 instead of 20: it was registered under the same
  id as `product` and won the key, so `.menu 20` silently rendered the A2UI card
  and the product style was unreachable by number.
### Removed
- Menus 2 (payment), 3 (eventMessage), 10 (media), 11 (reaction) and 12
  (aiDynamic) are gone: unregistered and their type files removed. Owners who
  had one of them active fall back to menu 1, and `.menulist` no longer offers
  them. Note: the `System Stats` buttons in the surviving menus still point at
  `.menu aiDynamic`, which now answers that the style is not found.
### Removed
- Menu 16 (listFallback) is gone: the legacy listMessage menu is unregistered
  and its file removed. Owners who had it active fall back to menu 1, and
  `.menulist` no longer offers it.
### Changed
- Menu 21's card copy is warmer and shorter: the counts line is now just the bot
  name, the pitch is `Just hanging out here. What’s up?`, the owner rows read
  `Made by` / `DM` / `Our channel`, and the hint reads `Need something? Try help
  <section> · menulist`. The picker button reads `Browse sections`, rows read
  `N to explore` with no usage mark, shortcuts carry the count in parentheses,
  and the bar reads `Take a look around` / `Need a little help?`.
- Menu 21's bot name renders in the display style on the footer name line, the
  picker section titles and the bar offer, and the owner-row labels and picker
  button title render in small caps. Greeting, pitch, hint, row text, shortcuts
  and the copy affordance stay plain.
### Changed
- Menu 21 no longer prints the category listing in the card. The numbered index
  and its `+N more in the picker` tail are gone; the picker below the card is the
  only place sections are listed, and it still carries every one of them. The card
  keeps the greeting, the counts line with the pitch, the owner rows and the one
  hint, and it shortened from about 19 lines to 8.
### Changed
- Menu 21's copy is now four blocks with a blank line between them: a greeting, a
  line about the bot, the index, and the owner details as labelled rows.
  - Greeting is time aware, read in `Africa/Accra` rather than the server's clock,
    and names the reader's push name when there is one (`🌆 Good evening, Skyler`).
    Five bands: still up, morning, afternoon, evening, good night.
  - The catch line sits under the counts: `Downloads, AI, media and group control,
    one command away.`
  - Owner details are padded rows, one value per line: `Owner  Moonson`,
    `Chat  wa.me/…` from `config/owner.js`, `Channel  whatsapp.com/channel/…`.
- `buildDimIndex` became `buildMenuCopy`, since it no longer builds only an index,
  and `greetingFor` is exported with an injectable clock so the bands can be
  checked without waiting for the evening.

### Fixed
- Menu 21's index rows were wrapped in single backticks, copied from menu 19's
  footer. WhatsApp paints `footer.text` as plain text, so nothing was formatted:
  every line arrived as a literal backtick in front of the row. The footer now
  goes out bare, `src/menu/types/atlasMenu.js` pads the columns instead of
  wrapping them, and the atlas check asserts no backtick survives anywhere in the
  message.

### Added
- Menu 21 marks the categories it is actually driven through, from the counter the
  dispatcher persists in `db.stats.commandsUsed`. No extra group: the row that is
  already in the index carries the mark (`07 download · 15 commands · Most used`),
  so the picker stays one row per category and a tap still opens a category rather
  than jumping straight into a command. The mark sits in the row because
  `highlight_label` is a section field, and a one-row group per popular category
  would pad the index it is meant to summarise. `src/lib/topCommands.js` does the
  ranking and drops names that no longer resolve, commands with no category, and
  the owner and hidden buckets, so dev probes never mark a public row. With no
  recorded usage no row is marked.
### Changed
- Menu 21's section picker carries `icon: 'REVIEW'`, the thumbs up glyph menu 19
  paints on its review picker. It sits inside the `single_select` params beside the title
  and rows; the client resolves the name, so a name it does not know drops the
  icon silently instead of breaking the card.

### Fixed
- Menu 21 (`atlasMenu`) no longer strands categories. The picker was capped at
  three ten-row blocks, so every section past the 30th was unreachable while the
  footer tail still promised it sat in the picker. The picker now uses the
  client's own ten-block ceiling (100 categories) and the tail counts only the
  rows the picker actually carries, pointing at `help <section>` for the rest.
- Atlas shortcut labels are clamped to 20 characters, the width a `quick_reply`
  button shows, by dropping the count before the name: a long section such as
  `groupmanagement` used to overflow the button at 22 characters.
- Atlas picker rows print a section once: the title keeps the index rank
  (`01 owner`) and the description keeps the count (`63 commands`), instead of
  both lines repeating the same number.

### Added
- `.galaxybar` (`src/plugins/general/galaxybar.js`) and `src/lib/galaxyBar.js`:
  the galaxy bar treated as an empty container rather than fixed copy. Three
  slots (`limited_time_offer`, `bottom_sheet`, `tap_target_configuration`) are
  supplied independently; `buildGalaxyBar()` with no arguments is `{}`, a slot
  object with no keys is dropped, an explicit `''` is kept, and
  `fillGalaxyBar` grows a bar one slot at a time. Variants 1-5 send the
  container alone (empty, then each blank slot, then all three), 6 fills the
  offer, 7 sends the empty bar with a single CTA, and 8 grows from `{}` so the
  fill path can be seen on a device. Every probe rides the menu-19 carrier
  (viewOnce envelope, zero-width body, no footer, no header) so only the bar
  differs. galaxyMenu itself is untouched.
- `.testrich` now carries the same series as its own **Bar Probes** group, so
  the containers can be run next to the rich generators: `barempty`, `baroffer`,
  `barsheet`, `bartap`, `barall`, `barfill`, `barone`, `bargrow`. Both commands
  read the probe list from `src/lib/galaxyBar.js`, and a release check fails the
  build if a probe exists in one place but not the other.

### Added
- **Menu 21 `atlasMenu`** (`src/menu/types/atlasMenu.js`): a menu computed from
  the live registry instead of a hand-written catalogue. Sections are ranked by
  real command count and rendered as an aligned dim index in `footer.text`
  (menu 19's field choice, one backtick per row so columns stay monospace, and a
  zero-width body). The bar is filled with real content: the bot name on the
  channel link with the creator on the copy affordance, one divider between the
  picker and the shortcuts, and a callout teaching `help <section>`. Buttons are
  the multi-button opener pair plus up to six section shortcuts, all routing to
  `.help <section>`; there are no decorative buttons. No prefix is printed
  anywhere in the interface and there is no ASCII rule or box art. Borrowed techniques:
  viewOnce carrier, opener pair, channel pill, banner header. Not borrowed: the
  ASCII frame art, the hand-written info block, the 24-button stack. Menu 19 is
  untouched.
- `config/brand.js`: creator and signature are now **Moonson** (was Aizen), so
  every surface that reads the brand object credits the current owner.

### Fixed
- `.play` / `.ytmp4` extraction. Every keyless source behind them was dead
  (verified live 2026-11-17): the tioo `/youtube` route answers a 20-byte
  `{"status":true}` with no links, loader.to answers `api_key_required`,
  cobalt instances demand a JWT, Piped/Invidious return 403 or a disabled
  endpoint, and YouTube's own innertube player returns zero formats. `yt-dlp`
  (already in the image for Instagram) now leads the chain, ahead of tioo and
  loader.to, and was verified extracting real audio from the live Fly machine
  (itag 251, 400 kB/s, no bot check from the London IP). Video is capped at
  720p and m4a audio is preferred, so a 4K result can never be offered to
  WhatsApp. Failures are now reported per source instead of "both sources are
  down", and the bot check is classified with the exact cookie fix.
- `.play` no longer fetches the stream URL itself. A googlevideo URL is bound to
  the extracting IP and throttled over plain HTTP: a 3.5-minute track stalled
  past 60s from the live machine while yt-dlp pulled the same file at ~90 MiB/s.
  The audio now downloads through yt-dlp, transcodes to mp3 with the ffmpeg in
  the image, and is sent as a finished file, with the hosted route kept as a
  fallback.

### Added
- `src/lib/ytdlp.js`: yt-dlp bridge used by the YouTube downloader. Cookies
  are optional and resolve from `YOUTUBE_COOKIES_B64`, `YOUTUBE_COOKIES` or
  `/app/data/cookies.txt`; the Fly IP does not currently need them.

### Changed
- Style-text beautifying sweep across the remaining untouched strings
  (wording unchanged, typography only): greeting defaults and the
  milestone/promotion/demotion lines speak in native-italic voice; the
  group-join intro and greeting product-card footers use the bold-sans
  display name; the welcome-toggle and owner cards use bold+smallcaps
  field labels; the channel privilege block/caption italicize their
  voice paragraph; one duel voice line matches its card's italic lines.
  The outdated `NEXORA-MD` literal is corrected to `NEXORA MD` in all
  remaining user-facing strings (footers, card titles, fake-quote
  defaults); working URLs, code samples, comments, identifiers and the
  `richTestKit` fixtures are untouched.
- `enrichContext` default source URL now points at the renamed
  NexoraFlex repo instead of the old NEXORA-MD URL.

### Added
- `src/lib/stickerAnnotation.js`: sticker annotation, the technique behind the
  zapo `ReactImg` sample. It is `messageContextInfo.messageAssociation` with
  `associationType: 11` (`STICKER_ANNOTATION` in WAProto — `STATUS_REACTION` is
  18, and a real reaction is `reactionMessage` with no association). Clients
  that support associations paint the sticker on the parent message; others
  show it as a normal sticker. The sticker is resized to 512x512 WebP and
  *uploaded* first (`generateWAMessageContent` + `waUploadToServer`), because
  relaying a bare `url` leaves the client with a grey placeholder — which is
  why the sample never renders. `.mb annotate` demos it on the command message.

### Added
- `messageBuilder` now carries the message-building techniques menu 19
  (`src/menu/types/galaxyMenu.js`) uses, so one builder can express them:
  `.messageParams({...})` (galaxy bar + bottom sheet + tap target),
  `.multiButtonUnlock()` (the `has_multiple_buttons` opener pair that unlocks a
  stack beyond three buttons), `.galaxy(cta, flowId)` (galaxy_message bar),
  `.raw(name, params)` / `.requestContact()` (any other proto button family),
  `.forwarded({ score })` (forward promise + channel pill), `.viewOnce()` (raw
  relay inside a viewOnceMessage carrier) and `.jpegThumb(buffer)`. Cards using
  any of these are relayed as a raw `interactiveMessage` instead of through the
  fork's nativeFlow sugar; plain cards keep the proven sugar path.
- `single_select` accepts button-level `{ icon, multi }` and section
  `highlight_label`, as in menu 19.
- `.mb galaxy` demos the whole menu-19 stack.

### Fixed
- `.start` card copy is English ("Hey there", "Tap below to continue in a
  private chat"), and a release check now fails if Indonesian copy creeps into
  the new card and builder sources.

### Added
- `src/lib/messageBuilder.js` — chain-method message builder, a port of
  KYYDIW's zapo "Message Builder" (MIT © 2026 Ripki Dwi Putra / kyyinfinite,
  github.com/kyyinfinite/kyyinfinite/message.md) re-pointed at our Baileys
  fork. `button()` (quick_reply / cta_url / cta_copy / cta_call /
  single_select / bottom_sheet / limited_time_offer / send_location, header
  title + thumb), `legacyButton()` (buttonsMessage RESPONSE),
  `listMessage()` (legacy list, DMs only) and `airich()` (markdown, pipe
  tables, code cards, tips, suggestions, footer). Each has `.build()` and
  `.send(jid, { quoted })`.
- `.mb` — demo command for the builder: `.mb`, `.mb select`, `.mb legacy`,
  `.mb list`, `.mb ai`.

### Notes
- `.location()` keeps the zapo form: a location *header* above the body with the
  buttons beneath it. The fork's nativeFlow sugar only accepts image/video
  headers, so a location card is relayed as a raw `interactiveMessage`
  (`hasMediaAttachment: false`) and its buttons are converted to nativeFlow
  `{ name, params }`. `.locationButton()` still emits the explicit
  `send_location` button. `.mb location` demos the header.
- `listMessage` refuses in groups where the server rejects it, pointing at
  `.mb select`.

### Added
- `.start` — the "Start chatting" card from the zapo-js bases, in all four wire
  forms so a device can settle which one the reference screenshot uses:
  `.start` (cta_url → wa.me), `.start quick` (native-flow quick_reply),
  `.start legacy` (buttonsMessage RESPONSE, the solid-green rendering) and
  `.start contact` (a real vCard message, where WhatsApp paints its own green
  action bar). Header image comes from the brand banner.

### Added
- The zapo-style green "Start chatting" pill: a native-flow `cta_url` button
  opening `wa.me/<bot>` (chosen over `open_chat`, which the device audit shows
  renders inert). `sendBrandSheet` takes `startChat: true | { label, text }`
  and `.credits` now carries it next to its sheet pill. `.brand` stays on the
  single-pill layout from the proven screenshot.

### Added
- `src/lib/brandSheet.js` — the `.brand` full-screen sheet as a reusable
  builder (`sendBrandSheet` with `sections: [{ heading, lines }]` and named CTA
  presets). `.brand` and `.credits` both render through it, so `.credits` now
  opens the same sheet with a green "Contact Dev" CTA instead of arriving as a
  card with a cosmetic vCard bubble above it.

### Fixed
- Sheets no longer ship `wa.me/000000000000` when `PAIRING_PHONE` /
  `OWNER_NUMBERS` are unset: the contact number resolves from the live
  session's own JID first, then config, and an all-zero value is rejected.
  `.brand`'s group link also falls back to the support group instead of the
  zeroed wa.me URL.

### Changed
- `.ping` defaults to the in-chat HTML server monitor (`GenAIaeacdsnwHtmlPrimitive`
  with live latency / memory / cpu hydrated into the vendored template) instead
  of the product-card monitor. `.ping card` still sends the AIRich system card,
  `.ping text` the classic personality ping, and each style falls through to the
  next when a relay is refused. Footer no longer hardcodes the old author name.

### Added
- `src/lib/brandContact.js` — the green contact bubble from `.brand` as a shared
  helper (`buildBrandContactQuote`). `.credits` now carries it on the VIP card
  (and on its button-card / text tiers), so the reply bar paints the bot's
  contact card above the sheet; `.brand` uses the same helper instead of its
  own inline vCard.

### Added
- Promote and demote announcements arrive as group cards: the alert text is
  sent with a synthetic `groupInviteMessage` as its quoted context
  (`buildFakeGroupInviteQuote`, `inviteCode: 'null'` so no real invite is
  exposed), captioned "🎖️ New group admin" or "📉 Admin removed". The card
  image is the group's own icon, resized to a 320 px JPEG, falling back to the
  brand menu banner so it never ships blank.

### Added
- VIP unified-response cards on the commands that fit: `.stats`, `.about` and
  `.credits` now send the `.vipcard` envelope (product card + markdown + CTA
  shelf + link chips) via `src/lib/vipSurfaces.js`, each falling back to its
  previous card if the envelope fails. Greetings stay on the plain product
  card with the menu banner, as before.

### Added
- Welcome and goodbye greetings can render as a WhatsApp **product card**
  (style 5, now the default): the menu banner as the card image, the greeting
  copy as the description, the group and member number in body and footer.
  Same payload shape `.product` sends, so it renders wherever that does, and
  the @mention still travels in `mentions`. Pick another layout with
  `.setwelcome 1-4`.

- **Menu 20 renders again.** The A2UI route was a dead end: `InteractiveMessage
  .bloksWidget` (proto tag 66) does not exist in WhatsApp's proto — upstream
  WAProto defines header/body/footer plus the shop/collection/nativeFlow/
  carousel oneof and nothing else — so every surface was dropped by the client
  and the card arrived as bare text plus CTAs. Menu 20 now ships a native-flow
  card the client actually paints: brand banner, stats body, a category
  picker (one section per category, a row per command, tap opens
  `.help <category>`) and the three link buttons. The A2UI payload is still
  composed and schema-validated; it is simply not what carries the menu.
- README and `.testa2ui` now say plainly that the widget slot is fork-only
  and that the audit covers payloads, not device rendering.

### Fixed (earlier)
- A2UI surfaces now ship in the v0.9 wire format, which is why the widget
  area stayed empty while the card's own text and CTAs rendered fine. The
  pinned fork wrapped the whole surface in one `createSurface` object with
  `components` inside it; v0.9 allows only `surfaceId`/`catalogId` there
  (`additionalProperties: false`) and expects the tree in a separate
  `updateComponents` message, delivered as a message list. Every audit
  surface and menu 20 now validate against the published v0.9 schema.
- Button actions are wrapped as `{ functionCall: { call, args } }` instead of
  a bare `{ call, args }`, and `ChoicePicker` options carry `label`/`value`
  rather than `id` — both were schema violations that made the client drop
  the surface without an error.
- `.testa2ui probe` now sends the same card in three payload shapes
  (wrapper, raw list, legacy single-object) so the phone can settle which
  shape a client actually accepts.

- A2UI cards were invisible on the phone: menu 20 and every `.testa2ui`
  surface were sent as a widget-only `interactiveMessage`, which relays
  fine and then paints nothing on a client that does not render the
  `BloksWidget` slot — no card, no body, no error in the logs. Every A2UI
  card now ships with at least one native-flow CTA through
  `a2uiKit.a2uiEnvelopeSpec()`, so it renders as a normal interactive card
  (body text plus tappable buttons) and the surface is a pure enhancement
  on top. Menu 20 also carries its links as real buttons now (panel,
  channel, GitHub) instead of only inside the widget.
- `.testa2ui all` no longer fires 18 interactive cards back to back; the
  sweep paces the sends so WhatsApp stops dropping the tail.
- An unpaired main socket no longer retries every minute forever. When the
  main session has no creds (the normal case when numbers are linked
  through the web `/pair` page, which links sessions under
  `session/extras/`), the 408 retry idles at 15 minutes and says why once.
  `MAIN_SESSION_PAIR=true` restores the old behaviour.

### Added
- Level-up and profile styling, same mix as the menus: the level-up
  announcement (image caption, rich card, and plain fallback) speaks
  in the italic voice with dynamic values plain, the no-picture
  header uses the smallcaps treatment, and the card footer drops the
  outdated `NEXORA-MD` name. The `.userinfo` card and the `.profile`
  plain-text fallback use smallcaps field labels (values stay plain,
  wording and alignment unchanged). The rendered rank/level-up card
  footer watermark now reads `NEXORA MD`. Wording is unchanged
  everywhere; the rich table cards and the leaderboard keep their
  plain data rendering on purpose.
- `.testa2ui probe` — sends three variants of the same card (widget +
  buttons, buttons only, plain text) and reports what to conclude from
  which ones show up, so a device-side rendering question can be settled
  from the phone instead of the logs.

- Brand imagery wired in: every visual surface now serves the
  horror-cinematic brand set v2 hosted in this repo (`media/brand/`,
  via jsDelivr) instead of the placeholder art. `ASSET_URLS` points
  the thumbnail and document thumbnail at the obsidian crown logo,
  the menu banner at the rooftop banner, and welcome/goodbye at the
  new greeting art; the greeting defaults and `database/greeting.json`
  match. Menu styles 5-14 in `database/images.json` drop the
  nekos.life hotlinks for the banner, and the menu fallback and
  newsletter fallback thumbnail use it too. Owner overrides
  (`.setwelcomeimage`, `.setmenumedia`) still win over these
  defaults. Unchanged on purpose: the menu-loop video, the `.anime`
  command's nekos.life API, the `.b44` downloader, and the rich-card
  test fixtures.
- One-box unification: every text surface now renders in the single
  slim box shared by the reply frames. The plain-text menu template
  drops its modern/classic/minimal theme borders and the theme
  setting no longer affects it; the bot name renders via
  `brand.display` (a custom bot name stays plain, via the
  `displayName` guard), labels use small caps, the version stays
  plain, and category dividers sit at the wall. The `.credits`
  plain-text card takes the same box and the brand mix (styled name,
  script creator/signature, smallcaps labels) with its wording
  unchanged. The `.menulist` text fallback swaps its thick rules for
  the slim box. Unchanged on purpose: the data table (a grid, not a
  box), `galaxyMenu`, and the inline divider / badge / stat-row /
  progress-bar pieces.
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
