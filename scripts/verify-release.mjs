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
