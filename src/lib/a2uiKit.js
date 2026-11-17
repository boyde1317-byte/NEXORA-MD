/**
 * @file src/lib/a2uiKit.js
 *
 * A2UI v0.9 surfaces for NEXORA MD — the native BloksWidget card.
 *
 * The pinned fork (baileys ≥ v0.3.18-r19) composes an A2UI v0.9 surface
 * locally and ships it in `InteractiveMessage.bloksWidget`; the client parses
 * the JSON and renders real native components (layout, text, tabs, lists,
 * buttons, form inputs). No Meta Flow, WABA or flow_id is involved.
 *
 * This module is the single NEXORA entry point for that surface:
 *
 *   A2                 — the fork's component builders (column, text, tabs, …)
 *   buildA2ui()        — compose + VALIDATE a surface before it is sent
 *   attachA2ui()       — validated widget for hand-built interactive envelopes
 *                        (galaxyMenu and friends, which relay raw protos)
 *   sendA2uiSurface()  — send a surface as its own card, plain-text fallback
 *   surfaceToText()    — readable rendering of any surface (fallback + report)
 *   auditSurfaces()    — one surface per catalog component, for `.testa2ui`
 *
 * WHY VALIDATION: an invalid surface is accepted by the send path and only
 * fails on the device, as an `A2UIValidationException` with no card and no
 * error the bot can see (hit live on 2026-10-22: a duplicate `root` id made
 * every referenced child unreachable). Every path here validates first and
 * falls back to text rather than sending a card that will not render.
 */

import {
  A2UI,
  A2UI_BASIC_CATALOG,
  A2UI_VERSION,
  CATALOG_COMPONENT_NAMES,
  bloksWidgetSupport,
  buildA2uiSurface,
  resolveBloksWidget,
  validateA2uiComponents,
} from 'baileys';
import { ASSET_URLS } from '../assets/assetUrls.js';

/** Component builders, namespaced: `A2.text('t', 'hi', 'h3')`. */
export const A2 = A2UI;

/** Every component the v0.9 basic catalog defines (18). */
export const A2UI_COMPONENTS = CATALOG_COMPONENT_NAMES;

/** Catalog id the client resolves component names against. */
export const A2UI_CATALOG = A2UI_BASIC_CATALOG;

/** Surface spec version (v0.9). */
export const A2UI_SPEC_VERSION = A2UI_VERSION;

/**
 * True when the pinned proto can carry a BloksWidget. Cached inside the fork,
 * so this is cheap to call per send.
 */
export const a2uiSupported = () => bloksWidgetSupport();

// ─────────────────────────────────────────────────────────────────────────────
// Composition + validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compose and validate a surface.
 *
 * @param {object} input
 * @param {string} [input.uuid]        surface uuid (generated when omitted)
 * @param {object[]} input.components  A2UI component nodes, exactly one `root`
 * @param {string} [input.surfaceId]   override the namespaced surface id
 * @param {string} [input.catalogId]   override the catalog
 * @returns {{ok: boolean, surface: object|null, errors: string[], text: string}}
 */
/**
 * Wrap a bare `{ call, args }` button action in the `functionCall` object the
 * v0.9 catalog requires.
 *
 * The fork's `a2uiUrlButton()` emits `action: { call: 'openUrl', args: { url } }`,
 * but the spec's Action type is a oneOf of `{ event }` or `{ functionCall }` —
 * a bare `{call,args}` matches neither, so a client that validates the surface
 * rejects the whole card (nothing renders). `openUrl` is a basic-catalog
 * function and returns nothing, hence `returnType: 'void'`.
 *
 * @param {object} action
 * @returns {object} spec-shaped action
 */
export function normalizeA2uiAction(action) {
  if (!action || typeof action !== 'object') return action;
  if (action.event || action.functionCall) return action;
  if (typeof action.call === 'string') {
    return {
      functionCall: {
        call: action.call,
        args: action.args || {},
        returnType: action.call === 'openUrl' ? 'void' : 'boolean',
      },
    };
  }
  return action;
}

/** Shallow-copy the tree with spec-valid button actions. */
export function normalizeA2uiComponents(components = []) {
  if (!Array.isArray(components)) return components;
  return components.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const out = { ...node };
    if (Array.isArray(node.children)) out.children = [...node.children];
    if (Array.isArray(node.tabs)) out.tabs = node.tabs.map((t) => ({ ...t }));
    if (node.component === 'Button' && node.action) out.action = normalizeA2uiAction(node.action);
    // ChoicePicker options are { label, value } in the catalog (no `id`), and
    // `additionalProperties: false` rejects anything else. Callers that pass
    // { id, label } (a natural guess, and what auditSurfaces did first) get
    // their key renamed instead of the whole surface being dropped.
    if (node.component === 'ChoicePicker' && Array.isArray(node.options)) {
      out.options = node.options.map((opt) => {
        if (!opt || typeof opt !== 'object') return opt;
        if (opt.value !== undefined) return { label: opt.label, value: opt.value };
        const { id, ...rest } = opt;
        return { ...rest, value: rest.value ?? id ?? rest.label };
      });
    }
    return out;
  });
}

/**
 * Payload shapes, for A/B-ing against a real client.
 *
 *   'wrapper' — { messages: [createSurface, updateComponents] }   ← spec v0.9
 *   'list'    — [createSurface, updateComponents]                 ← same, raw array
 *   'legacy'  — { version, createSurface: { …, components } }     ← what the fork
 *               builds and what WhatsApp renders as empty (documented below)
 */
export const A2UI_SHAPES = ['wrapper', 'list', 'legacy'];
export const A2UI_DEFAULT_SHAPE = 'wrapper';

/** Pull the component array out of any supported payload shape. */
export function componentsOf(payload) {
  if (Array.isArray(payload)) {
    const upd = payload.find((m) => m && m.updateComponents);
    if (upd) return upd.updateComponents.components || [];
    return payload;
  }
  if (payload?.messages) return componentsOf(payload.messages);
  if (payload?.updateComponents) return payload.updateComponents.components || [];
  if (payload?.createSurface?.components) return payload.createSurface.components;
  return [];
}

/**
 * Compose the wire payload for a surface.
 *
 * A2UI v0.9 sends components in their own `updateComponents` message — the
 * `createSurface` message carries ONLY `surfaceId` and `catalogId`
 * (`additionalProperties: false`), so a `components` array inside it is
 * schema-invalid and is dropped by a validating client. That is why the fork's
 * single-object surface (`{ version, createSurface: { …, components } }`)
 * renders nothing on WhatsApp while the envelope around it is fine.
 *
 * @param {object} input
 * @param {string} [input.uuid]
 * @param {object[]} input.components
 * @param {string} [input.surfaceId]
 * @param {string} [input.catalogId]
 * @param {'wrapper'|'list'|'legacy'} [input.shape]
 * @returns {object|object[]} payload for bloksWidget.data
 */
export function buildA2uiMessages({ uuid, components, surfaceId, catalogId, shape = A2UI_DEFAULT_SHAPE } = {}) {
  const nodes = normalizeA2uiComponents(components);

  // Reuse the fork's builder only for its namespaced surface id + catalog id.
  const base = buildA2uiSurface({ uuid, components: nodes, surfaceId, catalogId });
  const sid = base.createSurface.surfaceId;
  const cat = base.createSurface.catalogId;

  if (shape === 'legacy') return base;

  const messages = [
    { version: A2UI_SPEC_VERSION, createSurface: { surfaceId: sid, catalogId: cat } },
    { version: A2UI_SPEC_VERSION, updateComponents: { surfaceId: sid, components: nodes } },
  ];

  return shape === 'list' ? messages : { messages };
}

/**
 * Compose and validate a surface.
 *
 * @param {object} input
 * @param {string} [input.uuid]        surface uuid (generated when omitted)
 * @param {object[]} input.components  A2UI component nodes, exactly one `root`
 * @param {string} [input.surfaceId]   override the namespaced surface id
 * @param {string} [input.catalogId]   override the catalog
 * @param {'wrapper'|'list'|'legacy'} [input.shape]  payload shape (default wrapper)
 * @returns {{ok: boolean, surface: object|null, components: object[], shape: string, errors: string[], text: string}}
 */
export function buildA2ui({ uuid, components, surfaceId, catalogId, shape = A2UI_DEFAULT_SHAPE } = {}) {
  const check = validateA2uiComponents(components);
  if (!check.ok) {
    console.warn('[a2uiKit] surface rejected before send: ' + check.errors.join('; '));
    return { ok: false, surface: null, components: [], shape, errors: check.errors, text: '' };
  }
  let surface = null;
  try {
    surface = buildA2uiMessages({ uuid, components, surfaceId, catalogId, shape });
  } catch (err) {
    return { ok: false, surface: null, components: [], shape, errors: [err.message], text: '' };
  }
  const nodes = componentsOf(surface);
  return { ok: true, surface, components: nodes, shape, errors: [], text: surfaceToText(surface) };
}

/**
 * Attach a validated A2UI surface to a hand-built interactiveMessage.
 *
 * Used by envelopes that relay raw protos (galaxyMenu): the widget is only
 * attached when the surface validates AND the proto can carry it, so a bad
 * card degrades to the plain interactive message instead of a dead one.
 *
 * @param {object} interactiveMessage  envelope being assembled (mutated)
 * @param {object[]|object} input      component array or a ready surface
 * @param {{uuid?: string}} [options]
 * @returns {object} the same interactiveMessage
 */
export function attachA2ui(interactiveMessage, input, options = {}) {
  if (!a2uiSupported() || !interactiveMessage) return interactiveMessage;

  let surface = input;
  if (Array.isArray(input)) {
    const built = buildA2ui({ uuid: options.uuid, components: input, shape: options.shape });
    if (!built.ok) return interactiveMessage;
    surface = built.surface;
  } else if (input?.createSurface || input?.updateComponents || input?.messages) {
    // A ready payload: validate whatever components it actually carries.
    const check = validateA2uiComponents(componentsOf(input));
    if (!check.ok) {
      console.warn('[a2uiKit] surface rejected before attach: ' + check.errors.join('; '));
      return interactiveMessage;
    }
  } else {
    return interactiveMessage;
  }

  const widget = resolveBloksWidget(surface, { uuid: options.uuid });
  if (widget) interactiveMessage.bloksWidget = widget;
  return interactiveMessage;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sending
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_URL = 'https://nexora-telegram.fly.dev';
const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326';

/**
 * Every A2UI card must carry at least one native-flow button.
 *
 * WHY (device finding, 2026-11-16): a widget-only interactiveMessage relays fine
 * and then renders as an empty/none bubble on a client that does not paint the
 * BloksWidget slot, with nothing in the bot logs to show for it. With one CTA
 * the very same message renders as a normal interactive card — body text plus
 * tappable buttons — and the widget simply adds the native layout on top where
 * the client supports it. Never send an A2UI surface without a CTA.
 */
export const DEFAULT_A2UI_CTA = [
  { text: 'Open NEXORA panel', url: PANEL_URL },
  { text: 'Channel', url: CHANNEL_URL },
];

/**
 * Build the exact `a2ui` content object that will be sent.
 *
 * Exported so the release gate can assert the envelope always carries a CTA
 * (the regression that made menu 20 and every `.testa2ui` card invisible).
 *
 * @param {object} spec  sendA2uiSurface spec
 * @returns {object} the `a2ui` payload
 */
export function a2uiEnvelopeSpec(spec = {}) {
  const { components, title, subtitle, footer, image } = spec;
  const cta = Array.isArray(spec.buttons) && spec.buttons.length ? spec.buttons : DEFAULT_A2UI_CTA;

  return {
    ...(spec.uuid ? { uuid: spec.uuid } : {}),
    components,
    ...(spec.surfaceId ? { surfaceId: spec.surfaceId } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    text: spec.text || spec.caption || title || 'NEXORA',
    ...(footer !== undefined ? { footer } : {}),
    ...(image !== undefined ? { image } : {}),
    buttons: cta,
    ...(spec.contextInfo ? { contextInfo: spec.contextInfo } : {}),
    ...(spec.viewOnce === true ? { viewOnce: true } : {}),
    // `widget: false` sends the same card without the surface, for A/B-ing
    // whether the surface or the envelope is what the device dislikes.
    ...(spec.widget === false ? { bloksWidget: false } : {}),
  };
}

/**
 * Send an A2UI surface card, falling back to plain text on any failure.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} spec
 * @param {object[]} spec.components   required — the surface
 * @param {string} [spec.title]        card header title
 * @param {string} [spec.subtitle]
 * @param {string} [spec.text]         card body (also the plain-text fallback)
 * @param {string} [spec.footer]
 * @param {{url: string}} [spec.image] header image (replaces the widget header)
 * @param {Array} [spec.buttons]       nativeFlow sugar, same shape as elsewhere
 * @param {string} [spec.uuid]
 * @param {object} [opts]              sendMessage options (quoted, …)
 * @returns {Promise<object>} the sent message
 */
export async function sendA2uiSurface(sock, jid, spec = {}, opts = {}) {
  const fallbackText = spec.text || spec.caption || spec.title || 'NEXORA';

  const built = buildA2ui({
    uuid: spec.uuid,
    components: spec.components,
    surfaceId: spec.surfaceId,
    shape: spec.shape,
  });
  if (!built.ok) {
    const reason = built.errors.join('; ');
    console.warn(`[a2uiKit] falling back to text (${reason})`);
    return sock.sendMessage(jid, { text: fallbackText }, opts);
  }

  // A widget-only interactiveMessage is accepted by the relay and then shows
  // NOTHING on a client that does not render the BloksWidget slot — no card,
  // no body, no error the bot can see. Attaching at least one native-flow CTA
  // makes the envelope a complete interactive card, so the body text and the
  // buttons always render and the widget is a pure enhancement on top.
  const envelope = a2uiEnvelopeSpec(spec);
  // Ship the spec-shaped payload we built; the fork stringifies `surface`
  // verbatim into bloksWidget.data. `warn: false` silences its own validator,
  // which only understands the fork's (invalid) single-object shape.
  envelope.surface = built.surface;
  envelope.warn = false;
  if (!a2uiSupported() && envelope.widget !== false) {
    console.warn('[a2uiKit] proto cannot carry a widget — sending the card without it');
    envelope.widget = false;
  }

  const nodes = built.components.length;
  const bytes = JSON.stringify(built.surface).length;
  console.log(`[a2uiKit] send shape=${built.shape} nodes=${nodes} bytes=${bytes} cta=${envelope.buttons.length}`);

  try {
    return await sock.sendMessage(jid, { a2ui: envelope }, opts);
  } catch (err) {
    console.warn('[a2uiKit] surface send failed, plain-text fallback:', err.message);
    return sock.sendMessage(jid, { text: fallbackText }, opts);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain-text rendering
// ─────────────────────────────────────────────────────────────────────────────

const line = (label, value) => (value === undefined || value === null || value === '' ? null : `${label}: ${value}`);

/**
 * Walk a surface from `root` and render it as readable text.
 * Used for the plain-text fallback and for the `.testa2ui` report.
 *
 * @param {object} surface  a built surface ({ version, createSurface })
 * @returns {string}
 */
export function surfaceToText(surface) {
  const nodes = componentsOf(surface);
  if (!Array.isArray(nodes) || nodes.length === 0) return '';

  const byId = new Map();
  for (const node of nodes) {
    if (node?.id) byId.set(node.id, node);
  }

  const seen = new Set();
  const walk = (id, depth = 0) => {
    const node = byId.get(id);
    if (!node || seen.has(id) || depth > 25) return [];
    seen.add(id);
    const pad = depth > 0 ? '  '.repeat(depth) : '';
    const kids = (ids) => ids.flatMap((k) => walk(k, depth + 1));

    switch (node.component) {
      case 'Text':
        return node.text ? [pad + node.text] : [];
      case 'Image':
        return ['[🖼️ ' + (node.description || 'image') + ']'];
      case 'Video':
        return ['[🎞️ video]'];
      case 'AudioPlayer':
        return ['[🔊 ' + (node.description || 'audio') + ']'];
      case 'Icon':
        return [pad + '• ' + (node.name || '')];
      case 'Divider':
        return ['──────────────────'];
      case 'Button': {
        const label = byId.get(node.child)?.text || 'Button';
        const url = node.action?.args?.url;
        return [pad + '[ ' + label + ' ]' + (url ? ' → ' + url : '')];
      }
      case 'Card':
      case 'Modal':
        return kids([node.child || node.content].filter(Boolean));
      case 'Tabs':
        return (node.tabs || []).flatMap((tab) => ['▸ ' + tab.title, ...walk(tab.child, depth + 1)]);
      case 'TextField':
        return [line(pad + node.label, node.value)].filter(Boolean);
      case 'CheckBox':
        return [pad + (node.value ? '[x] ' : '[ ] ') + node.label];
      case 'ChoicePicker': {
        const picked = (node.value || []).join(', ');
        return [pad + (node.label || 'Options') + ': ' + (picked || '—')];
      }
      case 'Slider':
        return [pad + (node.label || 'Value') + ': ' + node.value + '/' + node.max];
      case 'DateTimeInput':
        return [line(pad + (node.label || 'When'), node.value)].filter(Boolean);
      case 'Column':
      case 'Row':
      case 'List':
        return kids(node.children || []);
      default:
        return [];
    }
  };

  return walk(byId.has('root') ? 'root' : nodes[0]?.id).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Device audit surfaces (`.testa2ui` + scripts/verify-release.mjs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One surface per catalog component, so a single component that the device
 * rejects can be isolated instead of taking a whole card down.
 *
 * Every entry must validate (the offline suite asserts it). `all` builds one
 * surface that covers the entire catalog for a single-tap sweep.
 *
 * @returns {Array<{id: string, label: string, group: string, build: () => object[], note?: string}>}
 */
export function auditSurfaces() {
  const banner = ASSET_URLS.menuBanner;

  return [
    {
      id: 'text',
      label: 'Text — headings, body, small print',
      group: 'Layout',
      build: () => [
        A2.column('root', ['h', 'rule', 'b', 'rule2', 'small']),
        A2.text('h', 'NEXORA A2UI', 'h3'),
        A2.divider('rule'),
        A2.text('b', 'Body text rides the widget body column.'),
        A2.divider('rule2'),
        A2.text('small', 'caption-scale text', 'caption'),
      ],
    },
    {
      id: 'image',
      label: 'Image — banner header',
      group: 'Media',
      build: () => [
        A2.column('root', ['banner', 'cap']),
        A2.image('banner', banner, { variant: 'header', fit: 'cover', description: 'NEXORA banner' }),
        A2.text('cap', 'Header variant image', 'caption'),
      ],
    },
    {
      id: 'icon',
      label: 'Icon — catalog glyph',
      group: 'Media',
      build: () => [A2.column('root', ['i1', 'i2']), A2.icon('i1', 'star'), A2.icon('i2', 'call')],
    },
    {
      id: 'video',
      label: 'Video — inline player',
      group: 'Media',
      build: () => [A2.column('root', ['v']), A2.video('v', process.env.NEXORA_MENU_GIF_URL || banner)],
    },
    {
      id: 'audio',
      label: 'Audio — audio player',
      group: 'Media',
      build: () => [
        A2.column('root', ['a']),
        A2.audio('a', process.env.NEXORA_MENU_PTT_URL || banner, { description: 'NEXORA voice' }),
      ],
    },
    {
      id: 'list',
      label: 'List — vertical / horizontal',
      group: 'Layout',
      build: () => [
        A2.column('root', ['l', 'd', 'lh']),
        A2.list('l', ['li1', 'li2'], { direction: 'vertical', listStyle: 'unordered' }),
        A2.text('li1', 'First item'),
        A2.text('li2', 'Second item'),
        A2.divider('d'),
        A2.list('lh', ['lh1', 'lh2'], { direction: 'horizontal', listStyle: 'none' }),
        A2.text('lh1', 'A'),
        A2.text('lh2', 'B'),
      ],
    },
    {
      id: 'card',
      label: 'Card — nested panel',
      group: 'Layout',
      build: () => [
        A2.column('root', ['card']),
        A2.card('card', 'inner'),
        A2.column('inner', ['t']),
        A2.text('t', 'Content inside a Card', 'body'),
      ],
    },
    {
      id: 'tabs',
      label: 'Tabs — switchable panels',
      group: 'Layout',
      build: () => [
        A2.column('root', ['tabs']),
        A2.tabs('tabs', [
          { title: 'Overview', child: 'tab1' },
          { title: 'Commands', child: 'tab2' },
        ]),
        A2.column('tab1', ['t1']),
        A2.text('t1', 'Overview panel'),
        A2.column('tab2', ['t2']),
        A2.text('t2', 'Commands panel'),
      ],
    },
    {
      id: 'divider',
      label: 'Divider — horizontal / vertical',
      group: 'Layout',
      build: () => [
        A2.column('root', ['a', 'd1', 'b', 'd2']),
        A2.text('a', 'Above'),
        A2.divider('d1'),
        A2.text('b', 'Below'),
        A2.divider('d2', { axis: 'vertical' }),
      ],
    },
    {
      id: 'button',
      label: 'Button — url + action',
      group: 'Actions',
      build: () => [
        A2.column('root', ['open', 'open2', 'b1', 'b2']),
        A2.text('open', 'Open the panel'),
        A2.text('open2', 'Join the channel'),
        A2.urlButton('b1', 'open', PANEL_URL, { variant: 'primary' }),
        A2.urlButton('b2', 'open2', CHANNEL_URL, { variant: 'borderless' }),
      ],
    },
    {
      id: 'modal',
      label: 'Modal — trigger + content',
      group: 'Actions',
      build: () => [
        A2.column('root', ['trig', 'modal', 'sheet']),
        A2.text('trig', 'Open details'),
        A2.modal('modal', { trigger: 'trig', content: 'sheet' }),
        A2.column('sheet', ['st']),
        A2.text('st', 'Modal content renders here.'),
      ],
    },
    {
      id: 'textfield',
      label: 'TextField — short / long / number',
      group: 'Inputs',
      build: () => [
        A2.column('root', ['f1', 'f2', 'f3']),
        A2.textField('f1', 'Your name', { value: '' }),
        A2.textField('f2', 'Message', { value: 'Hello NEXORA', variant: 'longText' }),
        A2.textField('f3', 'Age', { value: '21', variant: 'number' }),
      ],
    },
    {
      id: 'checkbox',
      label: 'CheckBox — on / off',
      group: 'Inputs',
      build: () => [A2.column('root', ['c1', 'c2']), A2.checkBox('c1', 'Enable alerts', true), A2.checkBox('c2', 'Weekly digest', false)],
    },
    {
      id: 'choicepicker',
      label: 'ChoicePicker — chips / checkbox',
      group: 'Inputs',
      build: () => [
        A2.column('root', ['p1', 'p2']),
        A2.choicePicker('p1', {
          label: 'Theme',
          options: [
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' },
          ],
          value: ['dark'],
          variant: 'mutuallyExclusive',
          displayStyle: 'chips',
        }),
        A2.choicePicker('p2', {
          label: 'Categories',
          options: [
            { label: 'AI', value: 'ai' },
            { label: 'Games', value: 'games' },
            { label: 'Tools', value: 'tools' },
          ],
          value: ['ai', 'games'],
          variant: 'multipleSelection',
          displayStyle: 'checkbox',
        }),
      ],
    },
    {
      id: 'slider',
      label: 'Slider — bounded value',
      group: 'Inputs',
      build: () => [
        A2.column('root', ['s']),
        A2.slider('s', { label: 'Volume', min: 0, max: 10, value: 4 }),
      ],
    },
    {
      id: 'datetime',
      label: 'DateTimeInput — date + time',
      group: 'Inputs',
      build: () => [
        A2.column('root', ['dt']),
        A2.dateTimeInput('dt', {
          label: 'Reminder',
          value: new Date().toISOString().slice(0, 16),
          enableDate: true,
          enableTime: true,
        }),
      ],
    },
    {
      id: 'row',
      label: 'Row — horizontal layout',
      group: 'Layout',
      build: () => [
        A2.column('root', ['r']),
        A2.row('r', ['r1', 'r2'], { justify: 'spaceBetween', align: 'center' }),
        A2.text('r1', 'Left'),
        A2.text('r2', 'Right'),
      ],
    },
    {
      id: 'all',
      label: 'All — full catalog in one surface',
      group: 'Sweep',
      note: 'One card covering all 18 catalog components',
      build: () => [
        A2.column('root', ['hdr', 'banner', 'rule', 'body', 'card', 'tabs', 'list', 'form', 'open', 'btn']),
        A2.text('hdr', 'NEXORA A2UI v0.9 — full catalog', 'h3'),
        A2.image('banner', banner, { variant: 'header', fit: 'cover', description: 'NEXORA' }),
        A2.divider('rule'),
        A2.text('body', `${CATALOG_COMPONENT_NAMES.length} components composed locally, rendered natively.`),
        A2.card('card', 'cardcol'),
        A2.column('cardcol', ['icon2', 'cardtext']),
        A2.icon('icon2', 'star'),
        A2.text('cardtext', 'Card + Icon'),
        A2.tabs('tabs', [
          { title: 'Inputs', child: 'form' },
          { title: 'List', child: 'list' },
        ]),
        A2.list('list', ['l1', 'l2'], { direction: 'vertical', listStyle: 'ordered' }),
        A2.text('l1', 'List item one'),
        A2.text('l2', 'List item two'),
        A2.column('form', ['f1', 'c1', 'p1', 's1', 'dt']),
        A2.textField('f1', 'Name', { value: 'NEXORA' }),
        A2.checkBox('c1', 'Notifications', true),
        A2.choicePicker('p1', {
          label: 'Tier',
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
          ],
          value: ['pro'],
          variant: 'mutuallyExclusive',
          displayStyle: 'chips',
        }),
        A2.slider('s1', { label: 'Level', min: 0, max: 100, value: 42 }),
        A2.dateTimeInput('dt', { label: 'Starts', value: new Date().toISOString().slice(0, 16), enableDate: true, enableTime: true }),
        A2.text('open', 'Open the NEXORA panel'),
        A2.urlButton('btn', 'open', PANEL_URL, { variant: 'primary' }),
      ],
    },
  ];
}

export default {
  A2,
  A2UI_COMPONENTS,
  A2UI_CATALOG,
  A2UI_SPEC_VERSION,
  a2uiSupported,
  buildA2ui,
  attachA2ui,
  sendA2uiSurface,
  surfaceToText,
  auditSurfaces,
};
