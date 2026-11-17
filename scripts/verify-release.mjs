#!/usr/bin/env node
/**
 * scripts/verify-release.mjs — offline release gate for NEXORA MD.
 *
 * Everything here runs without a WhatsApp connection, an API key or a phone:
 * payload shapes, the A2UI surface layer, the menu/plugin registries and the
 * pinned fork version are asserted in-process. The device is still the
 * authority on rendering — `.testa2ui` / `.testrich` cover that — but nothing
 * that can be caught before a message leaves the process gets through.
 *
 * Usage:
 *   node scripts/verify-release.mjs          # all checks
 *   node scripts/verify-release.mjs a2ui     # only checks whose name matches
 *
 * Exit code 1 on any failure, so CI can gate on it.
 */
import { readFile } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);
const filter = process.argv[2]?.toLowerCase();

const results = [];
let currentSection = '';

const section = (name) => {
  currentSection = name;
  console.log(`\n── ${name} ──`);
};

async function check(name, fn) {
  const label = `${currentSection}: ${name}`;
  if (filter && !label.toLowerCase().includes(filter) && !name.toLowerCase().includes(filter)) {
    return;
  }
  try {
    const detail = await fn();
    results.push({ label, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    results.push({ label, ok: false, detail: err.message });
    console.log(`  FAIL  ${name} — ${err.message}`);
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith('.js')) acc.push(p);
  }
  return acc;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pinned fork
// ─────────────────────────────────────────────────────────────────────────────
section('Pinned fork');

const pkg = readJson('package.json');
const installedBaileys = require('baileys/package.json');
const pin = pkg.dependencies.baileys;
const pinTag = String(pin).split('#')[1];

await check('package.json pins a tagged fork revision', () => {
  assert(/^github:boyde1317-byte\/baileys#v\d+\.\d+\.\d+-r\d+$/.test(pin), `unexpected pin: ${pin}`);
  return pinTag;
});

await check('installed baileys matches the pin (lockfile not stale)', () => {
  assert(
    installedBaileys.version === pinTag.replace(/^v/, ''),
    `package.json wants ${pinTag}, node_modules has ${installedBaileys.version} — run npm install`
  );
  return installedBaileys.version;
});

await check('pinned fork ships the A2UI layer', async () => {
  const b = await import('baileys');
  assert(b.A2UI && typeof b.A2UI.surface === 'function', 'A2UI namespace missing');
  assert(typeof b.validateA2uiComponents === 'function', 'validateA2uiComponents missing');
  assert(Array.isArray(b.CATALOG_COMPONENT_NAMES), 'CATALOG_COMPONENT_NAMES missing');
  return `${b.CATALOG_COMPONENT_NAMES.length} catalog components`;
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. A2UI surface layer
// ─────────────────────────────────────────────────────────────────────────────
section('A2UI');

const kit = await import(join(root, 'src/lib/a2uiKit.js'));
const fork = await import('baileys');

await check('widget slot is supported by the pinned proto', () => {
  assert(kit.a2uiSupported(), 'bloksWidgetSupport() is false');
  return 'im_a2ui';
});

await check('every catalog component has a builder', () => {
  const builders = {
    Text: 'text', Image: 'image', Icon: 'icon', Video: 'video', AudioPlayer: 'audio',
    Row: 'row', Column: 'column', List: 'list', Card: 'card', Tabs: 'tabs',
    Modal: 'modal', Divider: 'divider', Button: 'button', TextField: 'textField',
    CheckBox: 'checkBox', ChoicePicker: 'choicePicker', Slider: 'slider',
    DateTimeInput: 'dateTimeInput',
  };
  const missing = kit.A2UI_COMPONENTS.filter((c) => !builders[c] || typeof kit.A2[builders[c]] !== 'function');
  assert(missing.length === 0, `no builder for: ${missing.join(', ')}`);
  return `${kit.A2UI_COMPONENTS.length} builders`;
});

await check('catalog covers the full v0.9 basic set', () => {
  assert(kit.A2UI_COMPONENTS.length === 18, `expected 18 components, saw ${kit.A2UI_COMPONENTS.length}`);
  return kit.A2UI_COMPONENTS.join(', ');
});

const audits = kit.auditSurfaces();

await check('audit surfaces all validate', () => {
  const bad = [];
  for (const t of audits) {
    const built = kit.buildA2ui({ components: t.build() });
    if (!built.ok) bad.push(`${t.id}: ${built.errors.join('; ')}`);
  }
  assert(bad.length === 0, bad.join(' | '));
  return `${audits.length} surfaces`;
});

await check('audit surfaces cover every catalog component', () => {
  const seen = new Set();
  for (const t of audits) {
    for (const node of t.build()) seen.add(node.component);
  }
  const missing = kit.A2UI_COMPONENTS.filter((c) => !seen.has(c));
  assert(missing.length === 0, `not exercised: ${missing.join(', ')}`);
  return `${seen.size} component types exercised`;
});

await check('audit surface ids are unique', () => {
  const ids = audits.map((t) => t.id);
  assert(new Set(ids).size === ids.length, 'duplicate audit ids');
  return ids.length.toString();
});

await check('surface text renders for every audit surface', () => {
  const empty = audits.filter((t) => {
    const built = kit.buildA2ui({ components: t.build() });
    return !built.ok || !built.text || built.text.trim().length === 0;
  });
  assert(empty.length === 0, `no text for: ${empty.map((t) => t.id).join(', ')}`);
  return 'plain-text fallback present';
});

await check('validation rejects the failures seen on device', () => {
  const { validate } = { validate: fork.validateA2uiComponents };
  const cases = {
    'duplicate root': [
      { id: 'root', component: 'Column', children: ['t'] },
      { id: 'root', component: 'Column', children: ['t'] },
      { id: 't', component: 'Text', text: 'x' },
    ],
    'unknown component': [
      { id: 'root', component: 'Column', children: ['x'] },
      { id: 'x', component: 'BottomSheet', text: 'nope' },
    ],
    'missing required prop': [{ id: 'root', component: 'Column', children: ['i'] }, { id: 'i', component: 'Image' }],
    'dangling child ref': [{ id: 'root', component: 'Column', children: ['ghost'] }],
    'no root': [{ id: 't', component: 'Text', text: 'x' }],
  };
  for (const [name, components] of Object.entries(cases)) {
    const res = validate(components);
    assert(res.ok === false, `validator accepted: ${name}`);
  }
  // …and accepts a good surface, so it is not simply always-failing
  const good = validate([{ id: 'root', component: 'Column', children: ['t'] }, { id: 't', component: 'Text', text: 'ok' }]);
  assert(good.ok === true, 'validator rejected a valid surface');
  return Object.keys(cases).length + ' rejections + 1 accept';
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Menu surfaces
// ─────────────────────────────────────────────────────────────────────────────
section('Menus');

const menuModule = await import(join(root, 'src/menu/types/a2uiSurface.js'));
const greetingCard = await import(join(root, 'src/greetings/greetingStyles/welcome5.js'));
const galaxy = await import(join(root, 'src/menu/types/galaxyMenu.js'));

const fakeMenuData = {
  botName: 'NEXORA MD',
  prefix: '.',
  totalCommands: 181,
  users: 42,
  groups: 7,
  uptime: '3d 4h',
  categories: {
    general: [{ name: 'about' }, { name: 'menu' }],
    ai: [{ name: 'chat' }, { name: 'imagine' }],
    games: [{ name: 'trivia' }],
    economy: [{ name: 'daily' }],
    owner: [{ name: 'setmenu' }],
  },
};

await check('A2UI menu surface validates', () => {
  const components = menuModule.buildA2uiMenuComponents(fakeMenuData);
  const built = kit.buildA2ui({ components });
  assert(built.ok, built.errors.join('; '));
  return `${components.length} nodes`;
});

await check('A2UI menu surface has no orphan components', () => {
  const components = menuModule.buildA2uiMenuComponents(fakeMenuData);
  const byId = new Map(components.map((c) => [c.id, c]));
  const seen = new Set();
  const walk = (id) => {
    if (!byId.has(id) || seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    for (const kid of node.children || []) walk(kid);
    if (node.child) walk(node.child);
    for (const tab of node.tabs || []) walk(tab.child);
    if (node.trigger) walk(node.trigger);
    if (node.content) walk(node.content);
  };
  walk('root');
  const orphans = components.filter((c) => !seen.has(c.id)).map((c) => c.id);
  assert(orphans.length === 0, `unreachable from root: ${orphans.join(', ')}`);
  return `${components.length} nodes reachable`;
});

await check('A2UI payload matches the v0.9 wire format', () => {
  const built = kit.buildA2ui({
    components: [
      kit.A2.column('root', ['t', 'lbl', 'btn']),
      kit.A2.text('t', 'Title', 'h3'),
      kit.A2.text('lbl', 'Open'),
      kit.A2.urlButton('btn', 'lbl', 'https://example.com'),
    ],
  });
  assert(built.ok, built.errors.join('; '));
  const payload = built.surface;
  const messages = payload.messages;
  assert(Array.isArray(messages) && messages.length === 2, 'payload is not a two-message list');

  const create = messages[0].createSurface;
  assert(messages[0].version === 'v0.9', 'createSurface missing version v0.9');
  assert(create && create.surfaceId && create.catalogId, 'createSurface missing ids');
  // The spec forbids extra keys here (additionalProperties: false): components
  // inside createSurface is what made every card render as nothing.
  assert(!('components' in create), 'components leaked into createSurface');

  const update = messages[1].updateComponents;
  assert(messages[1].version === 'v0.9', 'updateComponents missing version v0.9');
  assert(update && update.surfaceId === create.surfaceId, 'updateComponents targets another surface');
  assert(Array.isArray(update.components) && update.components.length === 4, 'components missing');

  // Button actions must be spec-shaped: { functionCall | event }, never { call }.
  const button = update.components.find((c) => c.component === 'Button');
  assert(button.action.functionCall, 'button action is not wrapped in functionCall');
  assert(button.action.functionCall.call === 'openUrl', 'functionCall name lost');
  assert(button.action.functionCall.args.url === 'https://example.com', 'functionCall url lost');
  assert(button.action.functionCall.returnType === 'void', 'openUrl should return void');

  // ChoicePicker options are { label, value } only — an `id` key is rejected.
  for (const node of update.components) {
    if (node.component !== 'ChoicePicker') continue;
    for (const opt of node.options) {
      assert(opt.value !== undefined && opt.label !== undefined, 'choice option missing label/value');
      assert(opt.id === undefined, 'choice option still carries `id`');
    }
  }
  return `${update.components.length} nodes, ${messages.length} messages`;
});

await check('A2UI shape variants stay available for A/B', () => {
  const c = [kit.A2.column('root', ['t']), kit.A2.text('t', 'x')];
  const wrap = kit.buildA2ui({ components: c, shape: 'wrapper' });
  const list = kit.buildA2ui({ components: c, shape: 'list' });
  const legacy = kit.buildA2ui({ components: c, shape: 'legacy' });
  assert(wrap.surface.messages.length === 2, 'wrapper lost its message list');
  assert(Array.isArray(list.surface) && list.surface.length === 2, 'list shape is not an array');
  assert(legacy.surface.createSurface.components, 'legacy shape changed');
  assert(kit.componentsOf(wrap.surface).length === 2, 'componentsOf(wrapper) failed');
  assert(kit.componentsOf(list.surface).length === 2, 'componentsOf(list) failed');
  assert(kit.componentsOf(legacy.surface).length === 2, 'componentsOf(legacy) failed');
  return 'wrapper, list, legacy';
});

// ── Regression: an A2UI card must never be widget-only ──────────────────────
// A widget-only interactiveMessage relays fine and then renders as an empty
// bubble on any client that does not paint the BloksWidget slot — the exact
// "menu 20 does nothing / .testa2ui shows nothing" report. Every spec that
// reaches sendA2uiSurface has to resolve to at least one native-flow button.
await check('A2UI envelope always carries a native-flow CTA', () => {
  const noButtons = kit.a2uiEnvelopeSpec({ components: [{ id: 'root', component: 'Text', text: 'hi' }], text: 'x' });
  assert(Array.isArray(noButtons.buttons) && noButtons.buttons.length >= 1, 'envelope sent with no CTA');
  assert(noButtons.buttons.every((b) => b.text && b.url), 'CTA missing text/url');
  const own = kit.a2uiEnvelopeSpec({ components: [], text: 'x', buttons: [{ text: 'Docs', url: 'https://example.com' }] });
  assert(own.buttons.length === 1 && own.buttons[0].text === 'Docs', 'explicit buttons not honored');
  const bare = kit.a2uiEnvelopeSpec({ components: [], text: 'x', widget: false });
  assert(bare.bloksWidget === false, 'widget:false not forwarded');
  assert(bare.buttons.length >= 1, 'probe variant B lost its CTA');
  return `${noButtons.buttons.length} default CTAs`;
});

await check('A2UI menu card ships CTAs', () => {
  const spec = menuModule.buildA2uiMenuSpec(fakeMenuData);
  assert(Array.isArray(spec.buttons) && spec.buttons.length >= 1, 'menu 20 spec has no buttons');
  const envelope = kit.a2uiEnvelopeSpec(spec);
  assert(envelope.buttons.length >= 1, 'menu 20 envelope has no buttons');
  assert(envelope.components.length > 0, 'menu 20 envelope lost the surface');
  assert(envelope.bloksWidget !== false, 'menu 20 dropped its surface');
  assert(typeof envelope.text === 'string' && envelope.text.length > 0, 'menu 20 envelope has no body text');
  return `${spec.buttons.length} buttons, ${envelope.components.length} nodes`;
});

await check('A2UI menu picker carries every category', () => {
  const sections = menuModule.buildMenuSections(fakeMenuData);
  const catCount = Object.keys(fakeMenuData.categories).length;
  assert(sections.length === Math.min(3, catCount), `picker sent ${sections.length} sections for ${catCount} categories`);
  for (const section of sections) {
    assert(section.rows.length > 0, `section ${section.title} has no rows`);
    for (const row of section.rows) {
      assert(row.id.startsWith(fakeMenuData.prefix || '.'), `row id ${row.id} is not a command`);
    }
  }
  assert(menuModule.MENU_LINKS.length === 3, 'menu 20 lost a link button');
  return `${sections.length} sections, ${sections.reduce((n, s2) => n + s2.rows.length, 0)} rows, ${menuModule.MENU_LINKS.length} links`;
});

await check('command VIP surfaces build valid envelopes', async () => {
  const sent = [];
  const fakeSock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (j, m) => { sent.push(m); return 'OK'; } };
  const surfaces = await import(join(root, 'src/lib/vipSurfaces.js'));

  await surfaces.sendStatsRich(fakeSock, 'g@g.us', { markdown: '🟢 *Status:* Online', headline: '✅ Online' });
  await surfaces.sendAboutRich(fakeSock, 'g@g.us', { markdown: '*» USER*', body: 'About', status: '🟢 Online' });
  await surfaces.sendCreditsRich(fakeSock, 'g@g.us', { markdown: '💻 *Developer:* x' });

  assert(sent.length === 3, `expected 3 cards, relayed ${sent.length}`);
  const seen = [];
  for (const msg of sent) {
    const env = msg.botForwardedMessage?.message?.richResponseMessage;
    assert(env, 'a command card is not a richResponseMessage');
    assert(msg.messageContextInfo?.messageSecret, 'a command card is missing messageSecret');
    const decoded = JSON.parse(Buffer.from(env.unifiedResponse.data, 'base64').toString());
    const first = decoded.sections[0].view_model.primitive;
    assert(first.__typename === 'GenAIProductItemCardPrimitive', 'first section is not the product card');
    assert(first.image?.url, 'product card has no image');
    assert(decoded.sections.some((s2) => s2.view_model.primitive?.__typename === 'GenAIMarkdownTextUXPrimitive'), 'no markdown body');
    seen.push(msg.messageContextInfo.botMetadata.messageDisclaimerText);
  }
  return seen.join(', ');
});

await check('no Indonesian strings in the new card surfaces', async () => {
  const files = [
    'src/lib/messageBuilder.js',
    'src/lib/startCard.js',
    'src/plugins/general/start.js',
    'src/plugins/general/messagebuilder.js',
    'src/menu/types/atlasMenu.js',
    'src/lib/galaxyBar.js',
  ];
  const banned = /\b(Hai Kak|Silakan|Pilih salah|Salin Kode|dibuat dengan|kamu|belum|sudah|gak|nggak|lanjut|selesai|Halo)\b/;
  const hits = [];
  for (const file of files) {
    const src = readFileSync(join(root, file), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (banned.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  assert(hits.length === 0, `Indonesian copy found at ${hits.join(', ')}`);
  return 'card + builder sources are English-only';
});

await check('messageBuilder chains build the proven payloads', async () => {
  const { button, legacyButton, listMessage, airich } = await import(join(root, 'src/lib/messageBuilder.js'));

  const card = button().body('Pick').footer('f').title('T')
    .quick_reply('Ok', '.menu')
    .cta_url('Open', 'https://x.y', { webview: true })
    .cta_copy('Copy', 'Z1')
    .build();
  assert(card.buttons.length === 3, 'button(): expected 3 buttons');
  assert(card.buttons[0].id === '.menu', 'button(): quick_reply lost its id');
  assert(card.buttons[1].useWebview === true, 'button(): cta_url lost webview');
  assert(card.buttons[2].copy === 'Z1', 'button(): cta_copy lost the code');

  const withPicker = button().body('m')
    .single_select('Open', [{ title: 'Main', rows: [{ id: '.a', title: 'A' }] }])
    .bottom_sheet({ listTitle: 'All', buttonTitle: 'See all' })
    .limited_time_offer({ text: '50%', url: 'https://x.y', copyCode: 'OFF' })
    .build();
  assert(withPicker.buttons[0].sections[0].rows[0].id === '.a', 'single_select(): rows lost');
  assert(withPicker.optionText === 'See all' && withPicker.offerCode === 'OFF', 'overlays lost');

  const legacy = legacyButton().body('o').button('yes', 'Yes').build();
  assert(legacy.buttons[0].type === 1 && legacy.buttons[0].displayText === 'Yes', 'legacyButton(): wrong button shape');

  const list = listMessage().title('M').body('p').section('Main', [{ id: 'a', title: 'A' }]).build();
  assert(list.sections[0].rows[0].title === 'A', 'listMessage(): sections lost');

  const rich = airich().text('# Halo').table([['A', 'B'], ['1', '2']]).code('js', 'const a = 1').suggest(['next']).build();
  assert(/^\| A \| B \|/m.test(rich.markdown), 'airich(): pipe table not built');
  assert(/```js\nconst a = 1\n```/.test(rich.markdown), 'airich(): code block not built');
  assert(rich.suggest[0] === 'next', 'airich(): suggestions lost');

  // .location() keeps the zapo form: a location *header*, not a button.
  const sent = [];
  const sock = {
    user: { id: '233533416608:1@s.whatsapp.net' },
    relayMessage: async (_j, c) => { sent.push(c); return { key: { id: 'r' } }; },
    sendMessage: async (_j, b) => { sent.push(b); return { key: { id: 's' } }; },
  };
  await button(sock)
    .body('Location header')
    .location({ latitude: 5.6037, longitude: -0.187, name: 'HQ', address: 'Accra' })
    .quick_reply('Ok', '.menu')
    .send('120363000000000000@g.us');
  const loc = sent[0]?.interactiveMessage;
  assert(loc?.header?.locationMessage?.degreesLatitude === 5.6037, '.location() sent no location header');
  assert(loc.header.locationMessage.address === 'Accra', '.location() lost the address');
  assert(loc.header.hasMediaAttachment === false, '.location() header should not be a media attachment');
  assert(loc.nativeFlowMessage.buttons[0].name === 'quick_reply', '.location() lost its buttons');
  assert(
    !JSON.stringify(loc.nativeFlowMessage).includes('send_location'),
    '.location() should not emit a send_location button'
  );

  let threw = false;
  try { button().build(); } catch { threw = true; }
  assert(threw, 'button(): empty card should throw');
  return 'button / legacy / list / airich';
});

await check('messageBuilder exposes the menu-19 techniques', async () => {
  const { button } = await import(join(root, 'src/lib/messageBuilder.js'));
  const sent = [];
  const sock = {
    user: { id: '233533416608:1@s.whatsapp.net' },
    waUploadToServer: async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' }),
    relayMessage: async (_j, c) => { sent.push(c); return { key: { id: 'r' } }; },
    sendMessage: async (_j, b) => { sent.push(b); return { key: { id: 's' } }; },
  };

  await button(sock)
    .body('Galaxy card')
    .messageParams({
      bottom_sheet: { in_thread_buttons_limit: 0, list_title: 'All', button_title: ' ' },
      tap_target_configuration: { title: 'NEXORA', button_index: 0 },
    })
    .multiButtonUnlock()
    .galaxy('top bar', '.x7')
    .single_select('Menu', [{ title: 'Main', highlight_label: 'Crasher', rows: [{ id: '.menu', title: 'Menu' }] }], { icon: 'DOCUMENT', multi: true })
    .raw('cta_reminder', { display_text: 'Reminder', id: 'message' })
    .requestContact()
    .forwarded({ score: 97410 })
    .send('120363000000000000@g.us');

  const im = sent[0]?.interactiveMessage;
  assert(im, 'galaxy card did not relay an interactiveMessage');
  const names = im.nativeFlowMessage.buttons.map((b) => b.name);
  for (const required of ['single_select', 'call_permission_request', 'galaxy_message', 'cta_reminder', 'request_contact_info']) {
    assert(names.includes(required), `menu-19 stack lost ${required}`);
  }
  assert(JSON.parse(im.nativeFlowMessage.buttons[1].buttonParamsJson).has_multiple_buttons, 'opener pair does not unlock multi-button mode');
  const params = JSON.parse(im.nativeFlowMessage.messageParamsJson);
  assert(params.bottom_sheet && params.tap_target_configuration, 'messageParamsJson lost the sheet or tap target');
  const picker = JSON.parse(
    im.nativeFlowMessage.buttons.find((b) => b.name === 'single_select' && b.buttonParamsJson.includes('sections')).buttonParamsJson
  );
  assert(picker.icon === 'DOCUMENT' && picker.has_multiple_buttons === true, 'single_select lost icon/multi flags');
  assert(picker.sections[0].highlight_label === 'Crasher', 'single_select lost the section highlight label');
  assert(im.contextInfo?.forwardingScore === 97410, 'forwarded() score was overwritten');
  assert(!!im.contextInfo?.forwardedNewsletterMessageInfo, 'forwarded() dropped the channel pill');

  const vo = [];
  const sock2 = { ...sock, relayMessage: async (_j, c) => { vo.push(c); return { key: { id: 'r2' } }; } };
  await button(sock2).body('vo').quick_reply('Ok', '.menu').viewOnce().send('120363000000000000@g.us');
  assert(vo[0]?.viewOnceMessage?.message?.interactiveMessage, 'viewOnce() did not wrap the card');
  return 'galaxy / opener pair / params / pill / viewOnce';
});

await check('yt-dlp YouTube source extracts and reports its failures', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const stamp = process.pid;
  const okStub = `/tmp/ytdlp-ok-${stamp}`;
  const botStub = `/tmp/ytdlp-bot-${stamp}`;
  const argsLog = `/tmp/ytdlp-args-${stamp}`;
  const cookies = `/tmp/ytdlp-cookies-${stamp}.txt`;

  await fs.writeFile(
    okStub,
    `#!/bin/sh\nprintf '%s\\n' "$@" > ${argsLog}\n` +
      `echo '{"title":"Stub Song","uploader":"Stub","thumbnail":"https://i.ytimg.com/x.jpg","duration":200,` +
      `"formats":[{"url":"https://rr1.googlevideo.com/a.m4a","acodec":"mp4a.40.2","vcodec":"none","abr":128,"ext":"m4a"},` +
      `{"url":"https://rr1.googlevideo.com/a.webm","acodec":"opus","vcodec":"none","abr":160,"ext":"webm"},` +
      `{"url":"https://rr1.googlevideo.com/v4k.mp4","acodec":"none","vcodec":"avc1","height":2160,"ext":"mp4"},` +
      `{"url":"https://rr1.googlevideo.com/v.mp4","acodec":"none","vcodec":"avc1","height":720,"ext":"mp4"}]}'\n`,
    { mode: 0o755 }
  );
  await fs.writeFile(botStub, "#!/bin/sh\necho \"ERROR: [youtube] x: Sign in to confirm you're not a bot. Use --cookies\" >&2\nexit 1\n", { mode: 0o755 });
  await fs.writeFile(cookies, '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tstub\n');

  const prevBin = process.env.YTDLP_PATH;
  const prevCookies = process.env.YOUTUBE_COOKIES;
  process.env.YTDLP_PATH = okStub;
  process.env.YOUTUBE_COOKIES = cookies;

  try {
    const mod = await import(join(root, `src/lib/ytdlp.js?stub=${stamp}`));
    mod.resetCookieCache();
    assert(mod.resolveCookiePath() === cookies, 'cookie path was not resolved from YOUTUBE_COOKIES');

    const out = await mod.ytdlpExtract('https://youtu.be/aqz-KE-bpKQ');
    assert(out.title === 'Stub Song', 'yt-dlp extraction lost the title');
    assert(out.mp3?.endsWith('/a.m4a'), 'yt-dlp extraction did not pick the audio stream');
    assert(out.mp4?.endsWith('/v.mp4'), 'yt-dlp extraction did not pick the video stream');
    assert(out.height === 720, `yt-dlp picked a ${out.height}p video instead of capping at 720p`);
    assert(out.mp3?.endsWith('.m4a'), 'yt-dlp preferred Opus over the smaller m4a audio');

    const passedArgs = await fs.readFile(argsLog, 'utf8');
    assert(passedArgs.includes('--cookies') && passedArgs.includes(cookies), 'yt-dlp was called without the configured cookies');
    assert(passedArgs.includes('--no-playlist'), 'yt-dlp was allowed to expand a playlist');

    // The bot check must be classified, not swallowed as a generic error.
    process.env.YTDLP_PATH = botStub;
    const botPath = `/tmp/ytdlp-bot2-${stamp}`;
    await fs.copyFile(botStub, botPath);
    await fs.chmod(botPath, 0o755);
    process.env.YTDLP_PATH = botPath;
    let code = null;
    try {
      await mod.ytdlpExtract('https://youtu.be/aqz-KE-bpKQ');
    } catch (err) {
      code = err.code;
    }
    assert(code === 'BOT_CHECK', `bot check was classified as ${code} instead of BOT_CHECK`);
    return 'audio/video pick, cookie flag, bot-check classification';
  } finally {
    if (prevBin === undefined) delete process.env.YTDLP_PATH; else process.env.YTDLP_PATH = prevBin;
    if (prevCookies === undefined) delete process.env.YOUTUBE_COOKIES; else process.env.YOUTUBE_COOKIES = prevCookies;
    await fs.rm(okStub, { force: true });
    await fs.rm(botStub, { force: true });
    await fs.rm(argsLog, { force: true });
    await fs.rm(cookies, { force: true });
  }
});

await check('yt-dlp audio download produces a playable mp3 and cleans up', async () => {
  const fs = await import('node:fs/promises');
  const stamp = process.pid;
  const stub = `/tmp/ytdlp-dl-${stamp}`;

  // Stand-in for yt-dlp: honours -o and --print-to-file, writes fake audio.
  await fs.writeFile(
    stub,
    `#!/bin/sh
out=""; meta=""; mfile=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --print-to-file) meta="$2"; mfile="$3"; shift 3 ;;
    *) shift ;;
  esac
done
file=$(printf '%s' "$out" | sed 's/%(ext)s/mp3/')
printf 'ID3-STUB-AUDIO' > "$file"
if [ -n "$mfile" ]; then
  printf '"Stub Song"\n"Stub Artist"\n123\n"https://i.ytimg.com/x.jpg"\n' > "$mfile"
fi
exit 0
`,
    { mode: 0o755 }
  );

  const prevBin = process.env.YTDLP_PATH;
  process.env.YTDLP_PATH = stub;
  try {
    const mod = await import(join(root, `src/lib/ytdlp.js?dl=${stamp}`));
    const dl = await mod.ytdlpDownload('https://youtu.be/aqz-KE-bpKQ', { mode: 'audio' });
    assert(dl.mimetype === 'audio/mpeg', `download mimetype was ${dl.mimetype}`);
    assert(dl.sizeBytes > 0, 'download reported an empty file');
    assert(dl.title === 'Stub Song', `metadata title was ${dl.title}`);
    assert(dl.author === 'Stub Artist', `metadata author was ${dl.author}`);
    assert(dl.duration === 123, `metadata duration was ${dl.duration}`);
    const bytes = await fs.readFile(dl.file, 'utf8');
    assert(bytes === 'ID3-STUB-AUDIO', 'the downloaded file was not the transcoded mp3');

    await mod.cleanupDownload(dl.dir);
    const stillThere = await fs.stat(dl.dir).then(() => true).catch(() => false);
    assert(!stillThere, 'the download temp directory was not cleaned up');
    return 'mp3 file, metadata, temp cleanup';
  } finally {
    if (prevBin === undefined) delete process.env.YTDLP_PATH; else process.env.YTDLP_PATH = prevBin;
    await fs.rm(stub, { force: true });
  }
});

await check('galaxy bar is an empty container, not a template', async () => {
  const bar = await import(join(root, 'src/lib/galaxyBar.js'));

  // The whole point: nothing supplied means nothing in the payload.
  assert(bar.buildGalaxyBar() === '{}', `empty bar was ${bar.buildGalaxyBar()}`);
  assert(bar.EMPTY_BAR === '{}', 'EMPTY_BAR is not a bare object');
  assert(!bar.barHasCopy(bar.EMPTY_BAR), 'the empty bar carries copy');
  assert(bar.barIsEmpty(bar.EMPTY_BAR), 'the empty bar reports slots');
  assert(!/[A-Za-z]/.test(bar.EMPTY_BAR), 'the empty bar contains letters');

  // A supplied slot with no keys is "not supplied", not an empty slot.
  const blankSlot = bar.buildGalaxyBar({ offer: {} });
  assert(blankSlot === '{}', `an empty slot object leaked into the bar: ${blankSlot}`);

  // An explicit blank string is a deliberate blank and must survive.
  const deliberate = JSON.parse(bar.buildGalaxyBar({ offer: { text: '', url: '' } }));
  assert(deliberate.limited_time_offer?.text === '', 'an explicit blank was dropped instead of kept');

  // undefined/null fields vanish at any depth.
  const messy = JSON.parse(bar.buildGalaxyBar({
    sheet: { list_title: 'Menu', button_title: null, divider_indices: [1, undefined, 3] },
  }));
  assert(!('button_title' in messy.bottom_sheet), 'a null field survived the build');
  assert(messy.bottom_sheet.divider_indices.length === 2, 'undefined survived inside an array');

  // Growing from empty: only the patched slot appears.
  const grown = JSON.parse(bar.fillGalaxyBar(bar.EMPTY_BAR, { offer: { text: 'Boarding now' } }));
  assert(Object.keys(grown).length === 1, `grow path produced ${Object.keys(grown).join(',')}`);
  assert(grown.limited_time_offer.text === 'Boarding now', 'grow path lost the supplied text');
  assert(!bar.barHasCopy(bar.EMPTY_BAR) && bar.barHasCopy(JSON.stringify(grown)), 'copy detection is inverted');

  // Filling a second slot must not disturb the first.
  const twice = JSON.parse(bar.fillGalaxyBar(JSON.stringify(grown), { sheet: { list_title: 'Actions' } }));
  assert(twice.limited_time_offer.text === 'Boarding now' && twice.bottom_sheet.list_title === 'Actions', 'fill did not merge slots');

  // Aliases resolve to protocol names, unknown names do not.
  assert(bar.resolveSlot('offer') === 'limited_time_offer', 'offer alias did not resolve');
  assert(bar.resolveSlot('tap') === 'tap_target_configuration', 'tap alias did not resolve');
  assert(bar.resolveSlot('nonsense') === null, 'an unknown slot name resolved');

  // Broken input never throws, it degrades to an empty bar.
  assert(JSON.stringify(bar.parseGalaxyBar('{not json')) === '{}', 'bad JSON did not degrade to empty');

  return 'empty by default, fills slot by slot, merges without inventing copy';
});

await check('galaxy bar plugin is registered and sends the carrier', async () => {
  const plugin = (await import(join(root, `src/plugins/general/galaxybar.js?t=${Date.now()}`))).default;
  assert(plugin.name === 'galaxybar', `plugin name was ${plugin.name}`);
  assert(Array.isArray(plugin.aliases) && plugin.aliases.includes('gbar'), 'gbar alias missing');
  assert(typeof plugin.execute === 'function', 'plugin has no execute');

  // Drive the plugin against a fake socket and inspect the relayed payload.
  const relayed = [];
  const replies = [];
  const sock = {
    user: { id: '233000000000:1@s.whatsapp.net' },
    relayMessage: async (_jid, message, opts) => { relayed.push({ message, opts }); },
    sendMessage: async (_jid, content) => { replies.push(content.text || ''); },
  };
  const m = { from: '233000000000@s.whatsapp.net' };

  await plugin.execute({ sock, m, args: [], prefix: '.' });
  assert(relayed.length === 1, `empty variant relayed ${relayed.length} messages`);

  const inner = relayed[0].message.viewOnceMessage.message.interactiveMessage;
  assert(inner.body.text === '\u200b', 'the carrier body is not a zero-width space');
  assert(!inner.footer, 'the probe added a footer');
  assert(inner.header.hasMediaAttachment === false, 'the probe attached header media');
  assert(inner.nativeFlowMessage.messageParamsJson === '{}', `payload bar was ${inner.nativeFlowMessage.messageParamsJson}`);
  assert(inner.nativeFlowMessage.buttons.length === 0, 'the empty probe carried buttons');
  assert(replies[0].includes('none (bar is {})'), 'the reply did not report an empty bar');

  // Variant 8 proves the fill path through the plugin, not just the lib.
  relayed.length = 0; replies.length = 0;
  await plugin.execute({ sock, m, args: ['bargrow', 'Boarding now'], prefix: '.' });
  const grown = JSON.parse(relayed[0].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.messageParamsJson);
  assert(grown.limited_time_offer?.text === 'Boarding now', 'bargrow did not fill the offer slot');
  assert(Object.keys(grown).length === 1, 'bargrow filled more than the requested slot');

  return 'relays the empty container, fills on request';
});

await check('galaxy bar probes are shared by .galaxybar and .testrich', async () => {
  const bar = await import(join(root, 'src/lib/galaxyBar.js'));
  const kit = await import(join(root, `src/lib/richTestKit.js?t=${Date.now()}`));

  const ids = bar.BAR_PROBES.map((p) => p.id);
  assert(ids.length === 8, `probe series has ${ids.length} entries`);
  assert(new Set(ids).size === ids.length, 'probe ids are not unique');

  // Every probe must be reachable from .testrich, or the two commands drift.
  const registered = new Set(kit.RICH_TESTS.map((t) => t.id));
  for (const id of ids) {
    assert(registered.has(id), `probe ${id} is not registered in .testrich`);
  }
  const group = kit.RICH_TESTS.filter((t) => t.group === 'Bar Probes');
  assert(group.length === ids.length, `Bar Probes group has ${group.length} entries`);

  // The blank probes must carry no human copy at all; the filled ones must.
  for (const probe of bar.BAR_PROBES) {
    const resolved = bar.resolveBarProbe(probe);
    if (probe.id === 'barfill' || probe.id === 'bargrow') {
      assert(bar.barHasCopy(resolved.bar), `${probe.id} carries no copy`);
    } else {
      assert(!bar.barHasCopy(resolved.bar), `${probe.id} invented copy`);
    }
    // Carrier invariants for every probe: dim body, no footer, no header media.
    const carrier = bar.buildBarCarrier({ bar: resolved.bar, buttons: resolved.buttons });
    const inner = carrier.viewOnceMessage.message.interactiveMessage;
    assert(inner.body.text === '\u200b', `${probe.id} body is not zero-width`);
    assert(!inner.footer, `${probe.id} added a footer`);
    assert(inner.header.hasMediaAttachment === false, `${probe.id} attached header media`);
  }

  // The filled probe is the only one that needs a button to anchor its strip.
  assert(bar.resolveBarProbe(bar.getBarProbe('barfill')).buttons.length === 1, 'barfill lost its CTA');
  assert(bar.resolveBarProbe(bar.getBarProbe('baroffer')).buttons.length === 0, 'baroffer grew a button');

  return `${ids.length} probes, shared and carrier-checked`;
});

await check('popular commands come from recorded usage', async () => {
  const { rankTopCommands } = await import(join(root, 'src/lib/topCommands.js'));

  const commands = new Map([
    ['play', { name: 'play', category: 'download' }],
    ['menu', { name: 'menu', category: 'general' }],
    ['addowner', { name: 'addowner', category: 'owner' }],
    ['ghost', { name: 'ghost', category: 'hidden' }],
    ['nocat', { name: 'nocat', category: null }],
  ]);
  const used = { play: 41, menu: 12, addowner: 999, ghost: 800, nocat: 700, removed: 500, zero: 0 };
  const ranked = rankTopCommands(used, commands, 5);

  assert(ranked.length === 2, `ranked ${ranked.length} commands: ${ranked.map((r) => r.name).join()}`);
  assert(ranked[0].name === 'play' && ranked[0].uses === 41, 'usage order broke');
  assert(ranked[1].name === 'menu', 'the tiebreak is not by name');
  assert(ranked[0].category === 'download' && ranked[1].category === 'general', 'the ranking lost the category the row needs');
  assert(!ranked.some((r) => ['addowner', 'ghost', 'nocat', 'removed', 'zero'].includes(r.name)), 'an unlistable command reached the ranking');
  assert(rankTopCommands({}, commands).length === 0, 'an empty counter produced a ranking');
  assert(rankTopCommands(used, undefined).length === 0, 'the ranker survived a missing registry');

  return 'owner/hidden/unresolved dropped, ties by name, category carried, empty stays empty';
});

await check('atlas menu indexes the live registry', async () => {
  const atlas = await import(join(root, `src/menu/types/atlasMenu.js?t=${Date.now()}`));
  const bar = await import(join(root, 'src/lib/galaxyBar.js'));
  const { toSmallcaps } = await import(join(root, 'src/lib/smallcaps.js'));
  const { default: brand } = await import(join(root, `config/brand.js?t=${Date.now()}`));

  assert(atlas.atlasMenu.id === 21, `atlas id is ${atlas.atlasMenu.id}`);
  assert(typeof atlas.atlasMenu.renderer === 'function', 'atlas has no renderer');

  const categories = {
    core: [{ name: 'menu', description: 'Show the menu' }, { name: 'help', description: 'List commands' }],
    economy: Array.from({ length: 9 }, (_, i) => ({ name: `eco${i}`, description: `Economy ${i}` })),
    games: Array.from({ length: 4 }, (_, i) => ({ name: `game${i}`, description: `Game ${i}` })),
    media: Array.from({ length: 2 }, (_, i) => ({ name: `media${i}`, description: `Media ${i}` })),
  };

  // Sections come out biggest first, and empty sections never appear.
  const ranked = atlas.rankSections({ ...categories, empty: [] });
  assert(ranked[0].name === 'economy' && ranked[0].count === 9, 'sections are not ranked by size');
  assert(!ranked.some((s2) => s2.name === 'empty'), 'an empty section was listed');

  // No command spotlight: the menu never advertises a random toggle as news.
  assert(!('pickSpotlight' in atlas), 'the command spotlight is back');

  // Render against a fake socket: the payload is the contract.
  const sent = [];
  const sock = {
    user: { id: '233000000000:1@s.whatsapp.net' },
    relayMessage: async (_jid, message) => { sent.push(message); },
    waUploadToServer: async () => { throw new Error('no upload in check'); },
  };
  await atlas.atlasMenu.renderer({
    sock,
    m: { from: '233000000000@s.whatsapp.net', pushName: 'Skyler' },
    menuData: { prefix: '.', totalCommands: 17, categories },
  });

  assert(sent.length === 1, `atlas relayed ${sent.length} messages`);
  const inner = sent[0].viewOnceMessage.message.interactiveMessage;

  // The dim look: body is a single zero-width space, the copy lives in footer.text.
  assert(inner.body.text === '\u200b', `body is ${JSON.stringify(inner.body.text)} — copy leaked out of the footer`);
  const footer = inner.footer?.text || '';
  assert(footer.includes(brand.display.name), 'footer lost the bot name line');
  // The listing lives in the picker, not in the card: no category rows here.
  assert(!/^\d+ /m.test(footer), 'the card still lists categories');
  assert(!footer.includes('more in the picker'), 'the card still promises picker rows');
  assert(footer.includes(brand.creator), 'footer lost the creator signature');
  assert(footer.includes('help <section>'), 'footer lost the help hint');

  // Greeting block: time aware, and named after the reader when there is a name.
  assert(/^(?:🌙|🌄|☀️|🌆) (?:Still up|Good morning|Good afternoon|Good evening|Good night), Skyler$/m.test(footer), 'the greeting block is missing or unnamed');

  // Boundaries on a fixed clock. Accra is UTC, so the hours line up directly.
  for (const [time, want] of [['04:30', '🌙 Still up'], ['07:30', '🌄 Good morning'], ['12:30', '☀️ Good afternoon'], ['17:30', '🌆 Good evening'], ['23:30', '🌙 Good night']]) {
    const got = atlas.greetingFor(new Date(`2026-11-17T${time}:00Z`), '');
    assert(got === want, `${time} greets as ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
  assert(atlas.greetingFor(new Date('2026-11-17T07:30:00Z'), 'Skyler Gayle') === '🌄 Good morning, Skyler', 'the greeting does not use the first name');

  // What the bot is: the name, then the one catchy line.
  assert(footer.split('\n').includes(brand.display.name), 'the bot name line moved or changed');
  assert(/^Just hanging out here\. What’s up\?$/m.test(footer), 'the catch line is missing');

  // Owner details closed as labelled rows, one value per line, labels in small caps.
  assert(new RegExp(`^${toSmallcaps('Made by')} {2,}Moonson$`, 'm').test(footer), 'the owner row is missing');
  assert(new RegExp(`^${toSmallcaps('DM')} {2,}wa\\.me/@[a-z0-9._]+$`, 'm').test(footer), 'the chat row is missing or does not use the username');
  assert(!/wa\.me\/\d/.test(footer), 'the card prints the owner phone number');
  assert(new RegExp(`^${toSmallcaps('Our channel')} {2,}whatsapp\\.com/channel/`, 'm').test(footer), 'the channel row is missing');

  // No prefix anywhere in the interface: a printed prefix goes stale.
  assert(!/^[!./]help/m.test(footer), 'the hint still prints a prefix');
  assert(!footer.includes('menulist ·') === false || !/[!./]menulist/.test(footer), 'menulist still prints a prefix');

  // No rule lines or box art: dashes read as noise at footer size.
  assert(!/[─═━│┃╭╮╰╯├┤└┴┬▚▢]/.test(footer), 'the footer still draws ASCII rules');

  // No backticks at all: the footer is plain text, so they would show literally.
  assert(!footer.includes('`'), 'a literal backtick is showing in the footer');
  assert(!inner.body.text.includes('```'), 'the body is a code block, not a zero-width carrier');

  // Bar: filled, all three slots, divider after the opener pair.
  const parsed = bar.parseGalaxyBar(inner.nativeFlowMessage.messageParamsJson);
  assert(bar.barSlots(inner.nativeFlowMessage.messageParamsJson).length === 3, 'atlas left a bar slot empty');
  assert(bar.barHasCopy(inner.nativeFlowMessage.messageParamsJson), 'the bar carries no content');
  assert(parsed.limited_time_offer.copy_code === brand.creator, `bar copy_code is ${parsed.limited_time_offer.copy_code}`);
  assert(parsed.limited_time_offer.url.includes('whatsapp.com/channel'), 'the bar lost the channel link');
  assert(parsed.bottom_sheet.divider_indices[0] === 2, `divider sits at ${parsed.bottom_sheet.divider_indices}`);
  assert(!/^[!./]/.test(parsed.tap_target_configuration.description), 'the callout prints a prefix');

  // Buttons: opener pair first, then shortcuts that all route to .help.
  const btns = inner.nativeFlowMessage.buttons;
  assert(btns[0].name === 'single_select', `first button is ${btns[0].name}`);
  assert(btns[1].name === 'call_permission_request', 'the multi-button opener pair is missing');
  const replies = btns.slice(2);
  assert(replies.length === 4, `expected 4 shortcuts, got ${replies.length}`);
  for (const btn of replies) {
    assert(btn.name === 'quick_reply', `shortcut is ${btn.name}`);
    const params = JSON.parse(btn.buttonParamsJson);
    assert(params.id === `.help ${params.display_text.split(' ')[1]}`, `shortcut routes to ${params.id}`);
  }
  const picker = JSON.parse(btns[0].buttonParamsJson);
  assert(picker.has_multiple_buttons === true, 'the picker does not unlock multi-button mode');
  assert(picker.icon === 'REVIEW', `the picker carries icon ${picker.icon}`);
  assert(!picker.sections.some((s2) => s2.highlight_label), 'a bot with no usage grew a pill');
  assert(!picker.sections.flatMap((s2) => s2.rows).some((r) => r.description.includes('Most used')), 'a bot with no usage marks rows as hot');

  // Usage no longer marks rows: the picker lists every section plainly, and the
  // mark is gone rather than moved to a group or a pill.
  sent.length = 0;
  await atlas.atlasMenu.renderer({
    sock,
    m: { from: '233000000000@s.whatsapp.net', pushName: 'Skyler' },
    menuData: {
      prefix: '.',
      totalCommands: 17,
      categories,
      topCommands: [
        { name: 'eco0', uses: 41, category: 'economy' },
        { name: 'menu', uses: 12, category: 'core' },
      ],
    },
  });
  const hotPicker = JSON.parse(sent[0].viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson);
  const hotRows = hotPicker.sections.flatMap((s2) => s2.rows);
  assert(hotPicker.sections.length === 1, `the picker grew to ${hotPicker.sections.length} groups`);
  assert(hotRows.length === 4, `the picker lists ${hotRows.length} rows`);
  assert(!hotRows.some((r) => r.description.includes('Most used')), 'a usage mark came back');
  assert(hotRows.find((r) => r.id === '.help economy').description === '9 to explore', 'the economy row lost its count');
  assert(picker.sections.flatMap((s2) => s2.rows).length === 4, 'the picker does not list every section');

  // A registry wider than the picker used to strand sections behind a tail that
  // promised rows the picker never carried. One picker row is one category, so
  // the picker must carry all of them, and the card must list none of them.
  const wide = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [
    `sec${String(i).padStart(2, '0')}`,
    Array.from({ length: 40 - i }, (_, k) => ({ name: `c${i}_${k}`, description: 'wide' })),
  ]));
  sent.length = 0;
  await atlas.atlasMenu.renderer({ sock, m: { from: '233000000000@s.whatsapp.net' }, menuData: { prefix: '.', totalCommands: 800, categories: wide } });
  const wideInner = sent[0].viewOnceMessage.message.interactiveMessage;
  const wideRows = JSON.parse(wideInner.nativeFlowMessage.buttons[0].buttonParamsJson).sections.flatMap((s2) => s2.rows);
  assert(wideRows.length === 40, `picker carries ${wideRows.length} of 40 sections`);
  assert(wideInner.footer.text.includes(brand.display.name), 'the wide render lost the bot name line');
  assert(!/^\d+ /m.test(wideInner.footer.text), 'the card still lists the wide registry');

  // Shortcut labels stay inside what a quick_reply button can show, and picker
  // rows do not repeat the count the description already carries.
  sent.length = 0;
  await atlas.atlasMenu.renderer({
    sock,
    m: { from: '233000000000@s.whatsapp.net', pushName: 'Skyler' },
    menuData: {
      prefix: '.',
      totalCommands: 6,
      categories: {
        groupmanagement: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
        automation: [{ name: 'd' }, { name: 'e' }],
        economy: [{ name: 'f' }],
      },
    },
  });
  const longInner = sent[0].viewOnceMessage.message.interactiveMessage;
  for (const btn of longInner.nativeFlowMessage.buttons.slice(2)) {
    const params = JSON.parse(btn.buttonParamsJson);
    assert(params.display_text.length <= 20, `shortcut label runs ${params.display_text.length} chars: ${params.display_text}`);
  }
  for (const row of JSON.parse(longInner.nativeFlowMessage.buttons[0].buttonParamsJson).sections.flatMap((s2) => s2.rows)) {
    assert(!row.title.includes('·'), `picker row prints its count twice: ${row.title} / ${row.description}`);
  }

  // An empty registry must still send, not throw.
  sent.length = 0;
  await atlas.atlasMenu.renderer({ sock, m: { from: '233000000000@s.whatsapp.net' }, menuData: { prefix: '.', totalCommands: 0, categories: {} } });
  assert(sent.length === 1, 'atlas refused to render with no commands');
  const bare = sent[0].viewOnceMessage.message.interactiveMessage;
  assert(bare.body.text === '\u200b', 'the empty render moved copy out of the footer');
  assert((bare.footer?.text || '').includes(brand.display.name), 'an empty registry lost the bot name line');
  assert(!bar.barHasCopy(bar.buildGalaxyBar({})), 'the empty registry leaked copy into the bar');

  return 'dim footer greeting, no prefix, no ASCII rules, creator signature';
});

await check('sticker annotation builds a real annotation', async () => {
  const mod = await import(join(root, 'src/lib/stickerAnnotation.js'));
  const { default: sharp } = await import('sharp');

  const png = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 1 } },
  }).png().toBuffer();
  const webp = await mod.toStickerWebp(png);
  assert(webp.length > 0 && webp.slice(8, 12).toString() === 'WEBP', 'toStickerWebp did not emit WebP');

  const sent = [];
  const sock = {
    user: { id: '233533416608:1@s.whatsapp.net' },
    waUploadToServer: async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' }),
    relayMessage: async (_j, c) => { sent.push(c); return { key: { id: 'r' } }; },
  };
  await mod.annotateWithSticker(sock, '120363000000000000@g.us', {
    parentKey: { remoteJid: '120363000000000000@g.us', fromMe: false, id: 'PARENT123' },
    image: png,
  });

  const msg = sent[0];
  const assoc = msg?.messageContextInfo?.messageAssociation;
  assert(assoc?.associationType === 11, 'annotation associationType is not 11 (STICKER_ANNOTATION)');
  assert(assoc.parentMessageKey?.id === 'PARENT123', 'annotation lost the parent message key');
  // The sample's plain-URL sticker never renders: the media has to be uploaded.
  for (const field of ['url', 'mediaKey', 'fileSha256', 'fileEncSha256', 'directPath']) {
    assert(msg.stickerMessage?.[field], `annotation sticker is missing ${field} (media not uploaded)`);
  }
  assert(msg.stickerMessage.mimetype === 'image/webp', 'annotation sticker is not image/webp');

  let refusedUploaded = false;
  try { mod.buildAnnotationMessage({ parentKey: { id: 'x' } }); } catch { refusedUploaded = true; }
  assert(refusedUploaded, 'buildAnnotationMessage accepted a missing sticker');
  let refusedParent = false;
  try { mod.buildAnnotationMessage({ stickerMessage: {} }); } catch { refusedParent = true; }
  assert(refusedParent, 'buildAnnotationMessage accepted a missing parent key');

  return 'associationType 11 + uploaded media';
});

await check('.mb sends each builder form', async () => {
  const plugin = (await import(join(root, 'src/plugins/general/messagebuilder.js'))).default;
  const run = async (args, isGroup = false) => {
    const sent = [];
    const sock = {
      user: { id: '233533416608:1@s.whatsapp.net' },
      waUploadToServer: async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' }),
      relayMessage: async (_j, c) => { sent.push(c); return { key: { id: 'r' } }; },
      sendMessage: async (_j, b) => { sent.push(b); return { key: { id: 's' } }; },
    };
    const m = {
      from: '120363000000000000@g.us',
      key: { id: 'ORIG', remoteJid: '120363000000000000@g.us', participant: '1@s.whatsapp.net' },
      message: { conversation: '.mb' },
      reply: { error: async (msg) => { sent.push({ text: String(msg) }); } },
    };
    await plugin.execute({ sock, m, args, prefix: '.', isGroup });
    return sent[0] || {};
  };

  for (const variant of ['button', 'select', 'legacy', 'location', 'galaxy', 'ai']) {
    const out = await run([variant]);
    assert(Object.keys(out).length > 0, `.mb ${variant}: sent nothing`);
  }
  const listInGroup = await run(['list'], true);
  assert(/rejected by the server in groups/.test(listInGroup.text || ''), '.mb list in a group should refuse');
  const dmList = await run(['list'], false);
  assert(dmList.sections?.length, '.mb list in a DM should send a listMessage');
  return 'button / select / legacy / location / galaxy / ai / list';
});

await check('.start ships all four Start chatting wire forms', async () => {
  const plugin = (await import(join(root, 'src/plugins/general/start.js'))).default;
  const m = {
    from: '120363000000000000@g.us',
    key: { id: 'ORIG', remoteJid: '120363000000000000@g.us', participant: '1@s.whatsapp.net' },
    message: { conversation: '.start' },
    reply: { error: async (e) => { throw new Error(typeof e === 'string' ? e : 'reply.error'); } },
  };

  const run = async (args) => {
    const sent = [];
    const sock = {
      user: { id: '233533416608:1@s.whatsapp.net' },
      waUploadToServer: async () => ({ mediaUrl: 'https://mmg.whatsapp.net/x', directPath: '/x' }),
      relayMessage: async (_j, c) => { sent.push(c); return { key: { id: 'r' } }; },
      sendMessage: async (_j, b) => { sent.push(b); return { key: { id: 's' } }; },
    };
    await plugin.execute({ sock, m, args, prefix: '.' });
    return sent[0] || {};
  };

  const cta = await run([]).then((c) => c.interactiveMessage?.nativeFlowMessage?.buttons?.[0]);
  assert(cta?.name === 'cta_url', '.start default is not a cta_url button');
  assert(/^https:\/\/wa\.me\/\d{8,}$/.test(JSON.parse(cta.buttonParamsJson).url), '.start cta_url has no wa.me target');

  const quick = await run(['quick']).then((c) => c.interactiveMessage?.nativeFlowMessage?.buttons?.[0]);
  assert(quick?.name === 'quick_reply', '.start quick is not a quick_reply button');
  assert(JSON.parse(quick.buttonParamsJson).id.includes('start'), '.start quick reply id is unroutable');

  const legacy = await run(['legacy']);
  assert(legacy?.buttonsMessage?.buttons?.[0]?.type === 1, '.start legacy is not a RESPONSE button');

  const contact = await run(['contact']);
  assert(contact?.contacts?.contacts?.[0]?.vcard, '.start contact sent no vCard');
  assert(/waid=\d{8,}/.test(contact.contacts.contacts[0].vcard), '.start contact vCard has no waid');
  return 'cta_url / quick_reply / legacy / contact';
});

await check('.credits opens the brand sheet, not a vCard bubble', async () => {
  const { sendBrandSheet, renderSections } = await import(join(root, 'src/lib/brandSheet.js'));
  assert(/» \*/.test(renderSections([{ heading: 'H', lines: ['a', 'b'] }])), 'section renderer lost its headings');

  const creditsPlugin = (await import(join(root, 'src/plugins/general/credits.js'))).default;
  const brandPlugin = (await import(join(root, 'src/plugins/general/brand.js'))).default;
  const m = {
    from: '120363000000000000@g.us',
    key: { id: 'ORIG', remoteJid: '120363000000000000@g.us', participant: '1@s.whatsapp.net' },
    message: { conversation: '.credits' },
    reply: { error: async () => {} },
  };

  for (const [plugin, pill, section] of [
    [creditsPlugin, 'View Credits', 'Developed By'],
    [brandPlugin, 'View Brand Details', 'Who We Are'],
  ]) {
    const out = [];
    const sock = {
      user: { id: '233533416608:1@s.whatsapp.net' },
      relayMessage: async (_jid, content) => { out.push(content); return { key: { id: 'X' } }; },
      sendMessage: async (_jid, body) => { out.push(body); return { key: { id: 'Y' } }; },
    };
    await plugin.execute({ sock, m, args: [], prefix: '.' });

    const im = out[0]?.interactiveMessage;
    assert(im, `${plugin.name}: no interactiveMessage`);
    const btn = im.nativeFlowMessage?.buttons?.[0];
    assert(btn?.name === 'booking_confirmation', `${plugin.name}: not a booking sheet`);
    const params = JSON.parse(btn.buttonParamsJson);
    assert(params.display_text.includes(pill), `${plugin.name}: wrong pill label`);
    assert(params.description.includes(section), `${plugin.name}: sheet body missing "${section}"`);
    assert(params.phone_number.length >= 8 && !/^0+$/.test(params.phone_number), `${plugin.name}: sheet phone is bogus`);
    assert(!/wa\.me\/0{6,}/.test(params.booking_url), `${plugin.name}: CTA points at a zeroed number`);

    const startChat = (im.nativeFlowMessage.buttons || [])
      .map((b) => ({ name: b.name, params: JSON.parse(b.buttonParamsJson) }))
      .find((b) => b.name === 'cta_url' && /Start chatting/i.test(b.params.display_text));
    if (plugin.name === 'credits') {
      assert(startChat, 'credits: missing the Start chatting CTA');
      assert(/^https:\/\/wa\.me\/\d{8,}/.test(startChat.params.url), 'credits: Start chatting does not open a wa.me chat');
    } else {
      // .brand keeps the single-pill sheet from the proven device screenshot
      assert(im.nativeFlowMessage.buttons.length === 1, 'brand: extra pill would change the proven card');
    }
  }
  return 'credits + brand sheets';
});

await check('ping defaults to the in-chat html monitor', async () => {
  const ping = (await import(join(root, 'src/plugins/general/ping.js'))).default;
  const relayed = [];
  const sock = {
    user: { id: '233533416608:1@s.whatsapp.net' },
    sendMessage: async () => ({ key: { id: 'K1' } }),
    relayMessage: async (_jid, content) => { relayed.push(content); return 'MID'; },
  };
  const m = {
    from: '120363000000000000@g.us',
    key: { id: 'ORIG', remoteJid: '120363000000000000@g.us', participant: '1@s.whatsapp.net' },
    message: { conversation: '.ping' },
    reply: async () => {},
  };

  await ping.execute({ m, sock, args: [] });
  const rf = relayed.at(-1)?.botForwardedMessage?.message?.richResponseMessage;
  assert(rf, 'default ping relayed no rich message');
  const data = JSON.parse(Buffer.from(rf.unifiedResponse.data, 'base64').toString());
  const primitive = data.sections[0].view_model.primitive;
  assert(primitive.__typename === 'GenAIaeacdsnwHtmlPrimitive', 'default ping is not the html primitive');
  assert(!/%[A-Z_]+%/.test(primitive.payload), 'monitor template left unhydrated placeholders');
  assert(/Server Monitor/i.test(rf.submessages?.[0]?.messageText || ''), 'monitor submessage title missing');

  relayed.length = 0;
  await ping.execute({ m, sock, args: ['text'] });
  assert(relayed.length === 0, '.ping text still relayed a card');
  return 'html default, text opt-out';
});

await check('.credits card carries the brand contact bubble', async () => {
  const { buildBrandContactQuote } = await import(join(root, 'src/lib/brandContact.js'));
  const { sendCreditsRich } = await import(join(root, 'src/lib/vipSurfaces.js'));
  const relayed = [];
  const sock = { user: { id: '1@s.whatsapp.net' }, relayMessage: async (_j, c) => { relayed.push(c); return 'MID'; } };
  await sendCreditsRich(sock, 'g@g.us', { markdown: 'body', title: 'NEXORA-MD', quoted: buildBrandContactQuote() });
  const ctx = relayed[0]?.botForwardedMessage?.message?.richResponseMessage?.contextInfo;
  assert(ctx?.quotedMessage?.contactMessage, 'credits card lost the contact bubble');
  assert(/waid=\d{8,}/.test(ctx.quotedMessage.contactMessage.vcard || ''), 'contact vcard has no waid');
  return 'contact bubble';
});

await check('admin alerts quote a group invite card', async () => {
  const adminAlert = await import(join(root, 'src/greetings/adminAlert.js'));

  const promo = adminAlert.buildAdminQuote({
    groupJid: '120363000000000000@g.us', groupName: 'VERTEX DOWN', isPromotion: true,
  });
  const gi = promo.message.groupInviteMessage;
  assert(gi.groupJid === '120363000000000000@g.us', 'quote lost the real group jid');
  assert(gi.groupName === 'VERTEX DOWN', 'quote lost the group name');
  assert(gi.inviteCode === 'null', 'quote must not carry a real invite code');
  assert(/admin/i.test(gi.caption), 'promotion caption missing');
  assert(promo.key?.id?.startsWith('BAE5'), 'quote key id not synthesised');

  const demo = adminAlert.buildAdminQuote({ groupJid: 'g@g.us', groupName: 'G', isPromotion: false });
  assert(demo.message.groupInviteMessage.caption !== gi.caption, 'promote and demote captions are identical');

  const calls = [];
  const fakeSock = {
    profilePictureUrl: async () => { throw new Error('no icon'); },
    sendMessage: async (jid, body, opts) => { calls.push({ jid, body, opts }); return { key: { id: 'X' } }; },
  };
  await adminAlert.sendAdminAlert(fakeSock, 'g@g.us', {
    text: '🌟 @1 promoted', resolvedJid: '1@s.whatsapp.net', groupName: 'G', isPromotion: true,
  });
  assert(calls.length === 1, 'alert not sent');
  const sent = calls[0];
  assert(sent.opts?.quoted?.message?.groupInviteMessage, 'alert was sent without the invite card');
  assert(sent.body.mentions?.[0] === '1@s.whatsapp.net', 'mention dropped from the alert');
  return 'promote + demote';
});

await check('every card style rides on its waUtils card', async () => {
  // The card is the whole point of these styles: the bubble each menu replies on
  // has to be the product / order / contact / location / newsletter card, not the
  // incoming message. The bridge builds the message with `quoted` and then relays
  // it, so the card lands as contextInfo.quotedMessage on what actually goes out.
  const findQuoted = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 8) return null;
    if (value.quotedMessage) return Object.keys(value.quotedMessage).join(',');
    for (const inner of Object.values(value)) {
      const hit = findQuoted(inner, depth + 1);
      if (hit) return hit;
    }
    return null;
  };

  // [label, file, export, quoted card, own card key on the wire]
  // The quoted card alone is invisible to the reader (WhatsApp shows no card
  // preview in a quote), so the style's own message type has to lead. Newsletter
  // is the exception: it needs a channelJid to build an invite, so it keeps riding
  // on the quote until one is configured.
  const styles = [
    ['product', 'product.js', 'productMenu', 'productMessage', 'product'],
    ['order', 'orderMessage.js', 'orderMessageMenu', 'orderMessage', 'orderText'],
    ['contact', 'contact.js', 'contactMenu', 'contactMessage', 'contacts'],
    ['location', 'location.js', 'locationMenu', 'liveLocationMessage', 'location'],
    ['newsletter', 'newsletter.js', 'newsletterMenu', 'newsletterAdminInviteMessage', null],
  ];

  for (const [label, file, exported, wanted, ownCard] of styles) {
    const mod = await import(join(root, `src/menu/types/${file}`));
    const menu = mod[exported] || mod.default;
    // One ordered timeline: the card styles send their own card first and then
    // relay the interactive list, so order matters as much as content.
    const wire = [];
    const sock = {
      user: { id: '233000000000:1@s.whatsapp.net' },
      sendMessage: async (_jid, content, options) => { wire.push({ content, options }); return { key: { id: 'card' } }; },
      relayMessage: async (_jid, message) => { wire.push({ content: message }); return { key: { id: 'card' } }; },
      waUploadToServer: async () => { throw new Error('no upload in check'); },
    };
    await menu.renderer({
      sock,
      m: { from: '233000000000@s.whatsapp.net' },
      menuData: { prefix: '.', botName: 'NEXORA MD', totalCommands: 17, uptime: '1h', categories: {}, ownerName: 'Moonson' },
    });
    assert(wire.length >= 1, `the ${label} menu sent nothing`);

    const carried = wire.map((step) => findQuoted(step.content)
      || (step.options?.quoted?.message ? Object.keys(step.options.quoted.message).join(',') : null))
      .filter(Boolean);
    assert(carried.length, `the ${label} menu is quoted on nothing`);
    assert(carried[0].includes(wanted), `the ${label} menu rides on ${carried[0]}, expected ${wanted}`);

    // There is no separate leading card message: the strip carries the card.
    assert(wire.length === 1, `the ${label} menu sends ${wire.length} messages, expected one CTA card`);

    // The card body has to be an interactiveMessage with CTA rows. Asserted on the
    // source because the harness has no media upload, so Tier 1 would fall through
    // before the CTA card is ever built. buttonsMessage is the pill row Skyler
    // rejected and must not come back.
    const src = await readFile(join(root, `src/menu/types/${file}`), 'utf8');
    assert(src.includes('baileysBridge.sendCtaCard('), `the ${label} card is not sent as a CTA card`);
    assert(!src.includes('baileysBridge.sendButtonsCard('), `the ${label} card still uses the buttonsMessage pill row`);
    assert(!src.includes('baileysBridge.sendNativeFlow('), `the ${label} card still uses nativeFlow buttons`);
  }

  return '5 card styles ride CTA interactiveMessage cards';
});

await check('menu 21 points at the owner username, not the number', async () => {
  // The DM row used to print the owner's phone number. It now shows the
  // WhatsApp username instead, so the menu never exposes the number.
  const { buildMenuCopy } = await import(join(root, 'src/menu/types/atlasMenu.js'));
  const copy = buildMenuCopy([], {
    greeting: 'Good afternoon',
    creator: 'Moonson',
    ownerUsername: 'moonson3',
    channelUrl: 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326',
    botName: 'NEXORA MD',
  });
  assert(copy.includes('wa.me/@moonson3'), 'menu 21 does not print the owner username');
  assert(!/wa\.me\/\d/.test(copy), 'menu 21 still prints the owner phone number');
  return 'username only';
});

await check('every menu style keeps its copy in the grey footer', async () => {
  // Menu 21's look, now the house style: the copy sits in footer.text, which
  // WhatsApp paints small and grey, and the body is a zero-width space. Long
  // footers render whole on device, so nothing is trimmed. Menu 19 and 21 are
  // the two that already did this by hand; every other style has to opt in.
  const dir = join(root, 'src/menu/types');
  const handrolled = ['galaxyMenu.js', 'atlasMenu.js'];
  const styles = readdirSync(dir).filter((f) => f.endsWith('.js'));
  let checked = 0;
  for (const file of styles) {
    const src = await readFile(join(dir, file), 'utf8');
    if (!src.includes('renderer')) continue;
    if (handrolled.includes(file)) {
      assert(src.includes('footer'), `${file} lost its footer copy`);
      checked += 1;
      continue;
    }
    const grey = src.includes('dim: true') || src.includes('greyCopy(') || src.includes('DIM_BODY');
    assert(grey, `${file} still paints its menu copy in the body instead of the grey footer`);
    checked += 1;
  }
  assert(checked >= 15, `only ${checked} menu styles were checked`);
  return `${checked} styles grey`;
});

await check('greeting product card carries the menu banner', () => {
  const banner = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
  const card = greetingCard.buildGreetingProductCard({
    text: '👋 Welcome @254712345678 to *NEXORA HQ* — member #42',
    variables: { groupName: 'NEXORA HQ', memberCount: 42, mentionJid: '254712345678@s.whatsapp.net' },
    isWelcome: true,
    banner,
    sock: { user: { id: '233533416608:12@s.whatsapp.net' } },
  });
  assert(card.product, 'payload is not a productMessage');
  assert(card.product.title.includes('NEXORA HQ'), 'product title lost the group name');
  assert(card.product.description.includes('Welcome'), 'greeting copy missing from description');
  assert(card.image === banner, 'menu banner not attached');
  assert(card.body && card.footer.includes('#42'), 'body/footer lost the member count');
  assert(card.mentions?.[0] === '254712345678@s.whatsapp.net', 'mention dropped');
  assert(card.businessOwnerJid === '233533416608@s.whatsapp.net', 'businessOwnerJid not the session number');

  const bye = greetingCard.buildGreetingProductCard({
    text: 'Bye', variables: { groupName: 'NEXORA HQ', memberCount: 42 }, isWelcome: false,
  });
  assert(bye.product.title.startsWith('Goodbye'), 'goodbye card is not a goodbye');
  assert(bye.image === undefined, 'goodbye without a banner should not attach one');
  return 'welcome + goodbye';
});

await check('greeting product card ships as a productMessage', async () => {
  const built = await fork.generateWAMessageContent(
    greetingCard.buildGreetingProductCard({
      text: '👋 Welcome @1 to *G*',
      variables: { groupName: 'G', memberCount: 3, mentionJid: '1@s.whatsapp.net' },
      isWelcome: true,
      banner: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
      sock: { user: { id: '999@s.whatsapp.net' } },
    }),
    { upload: async () => ({ url: 'https://mmg.whatsapp.net/x' }) }
  );
  const type = Object.keys(built).find((k) => k === 'productMessage');
  assert(type, `generated ${Object.keys(built)[0]} instead of productMessage`);
  assert(built.productMessage.product?.title, 'product snapshot missing');
  assert(built.productMessage.contextInfo?.mentionedJid?.length === 1, 'mention lost on the wire');
  return `productMessage, ${Object.keys(built.productMessage).length} fields`;
});

await check('greeting style default is the product card', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'database/greeting.json'), 'utf-8'));
  assert(cfg.style === 5, `database/greeting.json ships style ${cfg.style}`);
  return 'style 5';
});

await check('A2UI menu renders a text fallback', () => {
  const built = kit.buildA2ui({ components: menuModule.buildA2uiMenuComponents(fakeMenuData) });
  assert(built.text.includes('Commands'), 'fallback text missing the stats block');
  return `${built.text.length} chars`;
});

await check('galaxy menu A2UI card validates', () => {
  const spec = galaxy.buildA2uiSpec('verify-uuid', 'https://example.com/banner.png');
  const res = fork.validateA2uiComponents(spec.createSurface.components);
  assert(res.ok, res.errors.join('; '));
  assert(spec.createSurface.surfaceId.includes('verify-uuid'), 'surface id not namespaced by uuid');
  return `${spec.createSurface.components.length} nodes`;
});

await check('menu registry is complete and collision-free', async () => {
  const { menuManager } = await import(join(root, 'src/menu/index.js'));
  const menus = menuManager.getRegisteredMenus();
  const ids = menus.map((m) => m.id);
  assert(new Set(ids).size === ids.length, 'duplicate menu ids');
  for (const menu of menus) {
    assert(typeof menu.renderer === 'function', `${menu.name}: no renderer`);
    assert(typeof menu.name === 'string' && menu.name, `${menu.id}: no name`);
    assert(Array.isArray(menu.supportedMessages) && menu.supportedMessages.length, `${menu.name}: no supportedMessages`);
  }
  assert(menuManager.getMenu('20'), 'A2UI menu (id 20) not registered');
  return `${menus.length} menus`;
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Plugins
// ─────────────────────────────────────────────────────────────────────────────
section('Plugins');

const pluginFiles = walk(join(root, 'src/plugins'));

// Import every plugin for real: a static grep cannot see factory-built
// plugins (rpg/fish.js) and cannot see a broken import path either — that is
// how .newsletter stayed dead for weeks with a wrong `../../config` depth.
const loadedPlugins = [];
const pluginImportErrors = [];
for (const file of pluginFiles) {
  const rel = file.replace(root + '/', '');
  try {
    const mod = await import(file);
    const plugin = mod.default;
    if (!plugin || typeof plugin !== 'object') {
      pluginImportErrors.push(`${rel}: no default export`);
      continue;
    }
    loadedPlugins.push({ file: rel, plugin });
  } catch (err) {
    pluginImportErrors.push(`${rel}: ${err.message}`);
  }
}

await check('every plugin file imports cleanly', () => {
  assert(pluginImportErrors.length === 0, pluginImportErrors.slice(0, 5).join(' | '));
  return `${pluginFiles.length} plugin files`;
});

await check('every plugin exports name / category / execute', () => {
  const bad = [];
  for (const { file, plugin } of loadedPlugins) {
    const problems = [];
    if (typeof plugin.name !== 'string' || !plugin.name) problems.push('name');
    // category: null is a hidden internal command (e.g. a button callback)
    if (!('category' in plugin)) problems.push('category');
    if (typeof plugin.execute !== 'function') problems.push('execute');
    if (problems.length) bad.push(`${file}: ${problems.join(', ')}`);
  }
  assert(bad.length === 0, bad.slice(0, 5).join(' | '));
  const hidden = loadedPlugins.filter(({ plugin }) => plugin.category === null).length;
  return `${loadedPlugins.length} plugins (${hidden} hidden)`;
});

await check('no duplicate command names or aliases', () => {
  const seen = new Map();
  const dupes = [];
  for (const { file, plugin } of loadedPlugins) {
    const names = [plugin.name, ...(Array.isArray(plugin.aliases) ? plugin.aliases : [])];
    for (const n of names) {
      if (typeof n !== 'string' || !n) continue;
      const key = n.toLowerCase();
      if (seen.has(key) && seen.get(key) !== file) dupes.push(`.${key} (${seen.get(key)} vs ${file})`);
      else seen.set(key, file);
    }
  }
  assert(dupes.length === 0, dupes.join(' | '));
  return `${seen.size} command names`;
});

await check('owner audit commands are registered', () => {
  const names = loadedPlugins.map(({ plugin }) => plugin.name);
  for (const required of ['testa2ui', 'testrich']) {
    assert(names.includes(required), `${required} missing`);
  }
  return 'testa2ui + testrich';
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Message-path invariants
// ─────────────────────────────────────────────────────────────────────────────
section('Message path');

const { capabilities } = await import(join(root, 'src/core/capabilities.js'));

await check('capabilities still advertise the rich paths the bot uses', () => {
  assert(capabilities.nativeFlow === true, 'nativeFlow lost');
  assert(capabilities.interactive === true, 'interactive lost');
  assert(
    capabilities.richResponse === (process.env.NEXORA_RICH_RESPONSE !== '0'),
    'richResponse flag disagrees with NEXORA_RICH_RESPONSE'
  );
  assert(capabilities.optionText === true, 'optionText lost');
  return 'nativeFlow, interactive, richResponse, optionText';
});

const { inspectMessage, filterCrashPayloads } = await import(join(root, 'src/core/payloadSanitizer.js'));

await check('crash-payload sanitizer drops the bug-bot bomb', () => {
  const bomb = {
    key: { remoteJid: '6281234567890@s.whatsapp.net', id: 'VERIFY1', fromMe: false },
    message: {
      groupStatusMessageV2: {
        message: {
          interactiveMessage: {
            nativeFlowMessage: { buttons: new Array(500000).fill({ name: 'quick_reply' }) },
          },
        },
      },
    },
  };
  const verdict = inspectMessage(bomb);
  assert(verdict && verdict.crash === true, 'bomb was not flagged');
  const kept = filterCrashPayloads([bomb, { key: { id: 'OK1' }, message: { conversation: 'hello' } }]);
  assert(kept.length === 1, `filter kept ${kept.length} of 2`);
  return verdict.reasons?.[0] || 'dropped';
});

await check('core message modules still import', async () => {
  const mods = [
    'src/core/baileysBridge.js',
    'src/core/serializer.js',
    'src/handlers/message.js',
    'src/lib/interactiveKit.js',
    'src/lib/richTestKit.js',
    'src/plugins/owner/testa2ui.js',
  ];
  for (const mod of mods) {
    await import(join(root, mod));
  }
  return `${mods.length} modules`;
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. AI rich formatting (prompt contract + markdown → rich blocks)
// ─────────────────────────────────────────────────────────────────────────────
section('AI rich formatting');

const { RICH_FORMAT_CONTRACT, buildAISystemPrompt, detectRichIntent } =
  await import(join(root, 'src/lib/aiRichFormat.js'));
const {
  parseAIMarkdown,
  buildAIMarkdownMessage,
  toWhatsAppMarkup,
  normalizeTable,
  MAX_TABLE_ROWS,
} = await import(join(root, 'src/lib/aiRichReply.js'));
const { NEXORA_SYSTEM_PROMPT } = await import(join(root, 'src/nexora-ai-prompt.js'));

const COMPARISON_MD = `*iPhone 15 vs Galaxy S24*

| Feature | iPhone 15 | Galaxy S24 |
|---|---|---|
| Display | 6.1" OLED | 6.2" AMOLED |
| Chip | A16 Bionic | Exynos 2400 |
| Price | $799 | $799 |

*Verdict:* iPhone 15 — longer support.`;

await check('comparison prompts are detected, chat prompts are not', () => {
  const cases = [
    ['compare iPhone 15 vs Galaxy S24', 'comparison'],
    ['which is better, Pixel or Samsung?', 'comparison'],
    ['what is the difference between TCP and UDP', 'comparison'],
    ['give me a table of african capitals', 'table'],
    ['how do I deploy this to fly.io', 'steps'],
    ['who is Kwame Nkrumah', 'profile'],
    ['give me info on Elon Musk', 'profile'],
    ['tell me about the Eiffel Tower', 'profile'],
    ['write a haiku about coffee', null],
    ['what is the capital of Ghana', null],
    ['recommend a laptop for video editing', null],
    ['summarize this article', null],
  ];
  for (const [prompt, expected] of cases) {
    const got = detectRichIntent(prompt).shape;
    assert(got === expected, `"${prompt}" -> ${got}, expected ${expected}`);
  }
  return `${cases.length} prompts`;
});

await check('rich prompt carries the contract, plain prompt does not', () => {
  const rich = buildAISystemPrompt('compare iPhone 15 vs Galaxy S24', { rich: true });
  assert(rich.startsWith(NEXORA_SYSTEM_PROMPT.slice(0, 60)), 'base persona dropped');
  assert(rich.includes(RICH_FORMAT_CONTRACT), 'contract missing');
  assert(/pipe table/i.test(rich), 'no table directive for a comparison');
  assert(/Verdict/.test(rich), 'no verdict line requested');

  const plain = buildAISystemPrompt('compare iPhone 15 vs Galaxy S24', { rich: false });
  assert(plain === NEXORA_SYSTEM_PROMPT, 'plain prompt was modified');
  assert(!plain.includes('pipe table'), 'plain prompt advertises tables');

  const poem = buildAISystemPrompt('write a haiku about coffee', { rich: true });
  assert(!/THIS TURN/.test(poem), 'shape directive leaked into an unrelated prompt');
  return 'contract gated on richResponse';
});

await check('only a real comparison or an explicit table request gets a table', () => {
  // The contract must forbid tabling a single subject outright.
  assert(/NEVER table a single subject/i.test(RICH_FORMAT_CONTRACT), 'contract does not forbid single-subject tables');

  const person = buildAISystemPrompt('who is Kwame Nkrumah', { rich: true });
  // Only the per-turn directive may demand a table — the shared contract
  // mentions one because it has to describe the rule.
  const personDirective = person.slice(person.indexOf('THIS TURN'));
  assert(/this is not a comparison/i.test(personDirective), 'person directive does not rule out a table');
  assert(!/pipe table/i.test(personDirective), 'person directive still demands a table');
  assert(!/Verdict/.test(personDirective), 'person directive asks for a comparison verdict');

  const comparison = buildAISystemPrompt('compare iPhone 15 vs Galaxy S24', { rich: true });
  assert(/Reply with exactly one pipe table/.test(comparison), 'comparison prompt lost its table directive');

  const chat = buildAISystemPrompt('write a haiku about coffee', { rich: true });
  assert(!/THIS TURN/.test(chat), 'an unrelated prompt got a shape directive');

  return 'table gated to comparisons only';
});

await check('comparison markdown becomes one native table block', () => {
  const blocks = parseAIMarkdown(COMPARISON_MD);
  assert(blocks.length === 3, `expected text/table/text, got ${blocks.length} blocks`);
  assert(blocks[1].type === 'table', 'table block missing');
  assert(blocks[1].rows.length === 4, `expected header + 3 rows, got ${blocks[1].rows.length}`);
  assert(blocks[1].rows[0].length === 3, 'expected 3 columns');
  assert(blocks[1].truncated === false, 'fresh table flagged truncated');
  return `${blocks[1].rows.length} rows x ${blocks[1].rows[0].length} cols`;
});

await check('table parsing survives real model output shapes', () => {
  // ragged row + escaped pipe
  const ragged = parseAIMarkdown('| A | B |\n|---|---|\n| rag |\n| x \\| y | z |');
  assert(ragged[0].rows[1].length === 2, 'ragged row not padded');
  assert(ragged[0].rows[2][0] === 'x | y', 'escaped pipe mangled');

  // no outer pipes + alignment cells
  const bare = parseAIMarkdown('Feature | A | B\n:--- | :---: | ---:\nPrice | 1 | 2');
  assert(bare[0].type === 'table' && bare[0].rows.length === 2, 'outer-pipe-less table lost');

  // CRLF
  const crlf = parseAIMarkdown('| A | B |\r\n|---|---|\r\n| 1 | 2 |\r\n');
  assert(crlf[0].type === 'table', 'CRLF table lost');

  // header with no body is not a table
  const empty = parseAIMarkdown('| just | header |\n|---|---|\n');
  assert(empty[0].type === 'text', 'empty grid shipped as a table');

  // table split by a blank line is rejoined
  const split = parseAIMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n\n| 3 | 4 |\n| 5 | 6 |');
  assert(split.length === 1 && split[0].rows.length === 4, 'split table not rejoined');

  // a table inside a fence stays code
  const fenced = parseAIMarkdown('```md\n| A | B |\n|---|---|\n| 1 | 2 |\n```');
  assert(fenced.length === 1 && fenced[0].type === 'code', 'fenced table became a table');

  return 'ragged/bare/CRLF/empty/split/fenced';
});

await check('wide and tall tables are capped with a note, not silently cut', () => {
  const wide = normalizeTable(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], [['1', '2', '3', '4', '5', '6', '7', '8']]);
  assert(wide.rows[0].length === 6, `expected 6 columns, got ${wide.rows[0].length}`);
  assert(wide.droppedCols === 2, `droppedCols ${wide.droppedCols}`);

  const long = Array.from({ length: 30 }, (_, i) => [`r${i}`, `v${i}`]);
  const tall = normalizeTable(['a', 'b'], long);
  assert(tall.rows.length === MAX_TABLE_ROWS + 1, `expected ${MAX_TABLE_ROWS + 1} rows, got ${tall.rows.length}`);
  assert(tall.truncated === true, 'tall table not flagged');
  return `cap ${MAX_TABLE_ROWS} rows x 6 cols`;
});

await check('AI markdown builds a richResponseMessage with a native table', () => {
  const built = buildAIMarkdownMessage({}, { markdown: COMPARISON_MD, footer: 'NEXORA • Gemini ✦' });
  assert(built && built.tableCount === 1, 'no table built');
  const msg = built.rich.build({});
  const rr = msg?.botForwardedMessage?.message?.richResponseMessage;
  assert(rr, 'richResponseMessage missing');

  const tableSub = rr.submessages.find((s) => s.messageType === 4);
  assert(tableSub, 'no messageType 4 submessage');
  assert(tableSub.tableMetadata.rows.length === 4, 'table rows lost in submessages');
  assert(tableSub.tableMetadata.rows[0].isHeading === true, 'header row not marked');

  const unified = JSON.parse(Buffer.from(rr.unifiedResponse.data, 'base64').toString());
  const prim = unified.sections.map((s) => s.view_model.primitive).find((p) => p?.__typename === 'GenATableUXPrimitive');
  assert(prim && prim.rows.length === 4, 'table primitive missing from unified response');
  assert(prim.rows[2].cells[2] === 'Exynos 2400', 'cell text mutated');
  assert(msg.messageContextInfo.botMetadata, 'bot metadata missing');
  return 'messageType 4 + GenATableUXPrimitive';
});

await check('a table-only reply gets a comparison lead-in, not a code one', () => {
  const built = buildAIMarkdownMessage({}, { markdown: '| A | B |\n|---|---|\n| 1 | 2 |' });
  const rr = built.rich.build({}).botForwardedMessage.message.richResponseMessage;
  const firstText = rr.submessages.find((s) => s.messageType === 2);
  assert(/comparison/i.test(firstText.messageText), `lead-in was "${firstText.messageText}"`);
  return firstText.messageText;
});

await check('AI replies fold double-asterisk markdown to WhatsApp markup', () => {
  const out = toWhatsAppMarkup('**Verdict:** __really__ and *already*');
  assert(out === '*Verdict:* _really_ and *already*', `got "${out}"`);
  const built = buildAIMarkdownMessage({}, { markdown: '**Bold** thing' });
  const rr = built.rich.build({}).botForwardedMessage.message.richResponseMessage;
  assert(!rr.submessages[0].messageText.includes('**'), 'raw ** reached the payload');
  return out;
});

await check('every AI reply path tries the rich renderer first', () => {
  const aiDir = join(root, 'src/plugins/ai');
  const files = readdirSync(aiDir).filter((f) => f.endsWith('.js'));
  const usesGenerator = files.filter((f) =>
    /aiTextGenerator\.(generateText|generateCode|debugCode|analyzeImage|proofreadText|brainstormIdeas|writeSong)/.test(
      readFileSync(join(aiDir, f), 'utf8')
    )
  );
  const missing = [];
  for (const f of usesGenerator) {
    const src = readFileSync(join(aiDir, f), 'utf8');
    const rich = /sendAIRichReply|richCodeCard|richTextCard|mixedCard/.test(src);
    if (!rich) missing.push(f);
  }
  assert(missing.length === 0, `no rich/fallback path in: ${missing.join(', ')}`);

  const gen = readFileSync(join(root, 'src/assets/aiTextGenerator.js'), 'utf8');
  assert(gen.includes('buildAISystemPrompt'), 'generator does not build the rich system prompt');
  assert(!/systemInstruction:\s*NEXORA_SYSTEM_PROMPT/.test(gen), 'generator still hardcodes the bare prompt');
  return `${usesGenerator.length} AI plugins`;
});

await check('owner can audit the AI format layer', () => {
  const names = loadedPlugins.map(({ plugin }) => plugin.name);
  assert(names.includes('aiformat'), 'aiformat audit command missing');
  return '.aiformat';
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Version + docs consistency
// ─────────────────────────────────────────────────────────────────────────────
section('Docs');

const brand = (await import(join(root, 'config/brand.js'))).default;

await check('brand version matches package.json', () => {
  assert(brand.version === pkg.version, `brand ${brand.version} vs package ${pkg.version}`);
  return pkg.version;
});

await check('README + CHANGELOG reference the current release', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const tag = pinTag.replace(/^v/, '');
  assert(changelog.includes(`[${pkg.version}]`), `CHANGELOG has no ${pkg.version} section`);
  assert(readme.includes(tag.replace(/\./g, '.')), `README does not mention ${tag}`);
  return `${tag} • v${pkg.version}`;
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

console.log(`\n${'─'.repeat(52)}`);
console.log(`${passed} passed, ${failed.length} failed (${results.length} checks)`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  ✗ ${f.label} — ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
