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

  let threw = false;
  try { button().build(); } catch { threw = true; }
  assert(threw, 'button(): empty card should throw');
  return 'button / legacy / list / airich';
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

  for (const variant of ['button', 'select', 'legacy', 'ai']) {
    const out = await run([variant]);
    assert(Object.keys(out).length > 0, `.mb ${variant}: sent nothing`);
  }
  const listInGroup = await run(['list'], true);
  assert(/rejected by the server in groups/.test(listInGroup.text || ''), '.mb list in a group should refuse');
  const dmList = await run(['list'], false);
  assert(dmList.sections?.length, '.mb list in a DM should send a listMessage');
  return 'button / select / legacy / ai / list';
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
