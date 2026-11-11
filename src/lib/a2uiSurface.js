/**
 * a2uiSurface.js — A2UI v0.9 surfaces for WhatsApp BloksWidget cards.
 *
 * What this is: a small, dependency-free composer for the `bloksWidget` slot on
 * `InteractiveMessage` (proto tag 66, field 8). The widget carries
 * `{ uuid, type: 'im_a2ui', data }` where `data` is a JSON *string* holding an
 * A2UI v0.9 `createSurface` document. WhatsApp's client parses that document
 * into real native components (Column, Row, Card, Text, Divider, Image,
 * Button), so the UI is composed by us and rendered by the client — nothing
 * about it needs a Meta-hosted Flow, a WABA, or a `flow_id`.
 *
 * The same `BloksWidget` message is also reachable from
 * `InteractiveMessage.Header.bloksWidget` (tag 82, field 10) as a oneof member
 * that replaces header media. There is no separate Header.BloksWidget
 * constructor: build it with `proto.Message.InteractiveMessage.BloksWidget`
 * and nest the finished object in whichever slot you want.
 *
 * Gate: the constructor only exists if the pinned proto carries it. Verified
 * present on fork tag v0.3.18-r17 (WAProto compiles `BloksWidget` as a nested
 * namespace with create/encode/decode, and it round-trips at field 8).
 * `bloksWidgetSupport()` caches that check, and `bloksWidgetFor()` refuses to
 * fail silently — a skipped card always logs why.
 *
 * Hard-won constraint (device, 2026-10-22): A2UI validation walks DOWN from a
 * component whose id is `root`. Duplicate root ids make every referenced child
 * unreachable and the widget dies with A2UIValidationException. Exactly one
 * `root`, every `child`/`children` reference resolvable, no duplicate ids —
 * `validateComponents()` enforces the cheap half of that before you send.
 */

import { proto } from 'baileys';

export const A2UI_VERSION = 'v0.9';
export const A2UI_BASIC_CATALOG =
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

/** Surface ids are namespaced; the client keys the widget off this string. */
const SURFACE_PREFIX = 'starcore-widget=';

/** `im_a2ui` is the widget type that selects the A2UI renderer. */
export const A2UI_WIDGET_TYPE = 'im_a2ui';

export const surfaceIdFor = (uuid) => SURFACE_PREFIX + String(uuid);

// ─── Component builders ──────────────────────────────────────────────────────
// Thin and literal on purpose: extra keys change what the client renders, so
// nothing is added unless you ask for it with an argument.

export const column = (id, children) => ({ id, component: 'Column', children: [...children] });
export const row = (id, children) => ({ id, component: 'Row', children: [...children] });

export const card = (id, child) => ({ id, component: 'Card', child });

export const text = (id, value, variant) => {
  const node = { id, component: 'Text', text: String(value) };
  if (variant) node.variant = variant;
  return node;
};

export const divider = (id) => ({ id, component: 'Divider' });

export const image = (id, url, { variant = 'header', fit = 'cover' } = {}) => ({
  id,
  component: 'Image',
  url,
  variant,
  fit,
});

/** A Button that opens a URL — `child` is the id of a Text node holding its label. */
export const urlButton = (id, child, url, { variant = 'borderless' } = {}) => ({
  id,
  component: 'Button',
  child,
  variant,
  action: { call: 'openUrl', args: { url } },
});

// ─── Surface ─────────────────────────────────────────────────────────────────

/**
 * Wrap components in the v0.9 createSurface envelope.
 * @param {{uuid: string, components: object[]}} input
 */
export function buildA2uiSpec({ uuid, components }) {
  if (!uuid) throw new TypeError('buildA2uiSpec: uuid is required');
  if (!Array.isArray(components) || components.length === 0) {
    throw new TypeError('buildA2uiSpec: components must be a non-empty array');
  }
  return {
    version: A2UI_VERSION,
    createSurface: {
      surfaceId: surfaceIdFor(uuid),
      catalogId: A2UI_BASIC_CATALOG,
      components,
    },
  };
}

/**
 * Cheap pre-flight for the failures that only surface as a server-side
 * A2UIValidationException. Warn-only by design: the device is the authority.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateComponents(components) {
  const errors = [];
  if (!Array.isArray(components) || components.length === 0) {
    return { ok: false, errors: ['no components'] };
  }

  const ids = new Set();
  const dupes = new Set();
  for (const c of components) {
    if (!c?.id) { errors.push('component without id'); continue; }
    if (ids.has(c.id)) dupes.add(c.id);
    ids.add(c.id);
  }
  if (dupes.size) errors.push('duplicate id(s): ' + [...dupes].join(', '));

  const roots = components.filter((c) => c?.id === 'root');
  if (roots.length === 0) errors.push('missing root component');
  if (roots.length > 1) errors.push('multiple root components');

  for (const c of components) {
    if (c?.child && !ids.has(c.child)) errors.push(`${c.id}.child → unknown "${c.child}"`);
    for (const kid of c?.children || []) {
      if (!ids.has(kid)) errors.push(`${c.id}.children → unknown "${kid}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Proto gate ──────────────────────────────────────────────────────────────

let _support;

/** True when the pinned proto can build a BloksWidget. Cached; cheap. */
export function bloksWidgetSupport() {
  if (_support !== undefined) return _support;
  try {
    _support = typeof proto?.Message?.InteractiveMessage?.BloksWidget?.create === 'function';
  } catch {
    _support = false;
  }
  return _support;
}

/**
 * Build the proto object for the widget slot.
 *
 * Returns `undefined` when the proto has no slot (older fork) — callers spread
 * it conditionally. Never throws: a broken card must not take a message down.
 * The skip is logged, because a silently missing widget is indistinguishable
 * from a rendering bug.
 *
 * @param {string} uuid   same uuid used in `surfaceIdFor(uuid)`
 * @param {object} spec   output of buildA2uiSpec
 * @param {{type?: string, warn?: boolean}} [options]
 */
export function bloksWidgetFor(uuid, spec, { type = A2UI_WIDGET_TYPE, warn = true } = {}) {
  if (!bloksWidgetSupport()) {
    if (warn) {
      console.warn('[a2ui] proto has no InteractiveMessage.BloksWidget — widget skipped (message still sent)');
    }
    return undefined;
  }

  const { ok, errors } = validateComponents(spec?.createSurface?.components);
  if (!ok && warn) {
    console.warn('[a2ui] surface may be rejected by A2UI validation: ' + errors.join('; '));
  }

  try {
    return proto.Message.InteractiveMessage.BloksWidget.create({
      uuid,
      type,
      data: JSON.stringify(spec),
    });
  } catch (err) {
    if (warn) console.warn('[a2ui] BloksWidget.create failed: ' + err.message);
    return undefined;
  }
}

export default {
  A2UI_VERSION,
  A2UI_BASIC_CATALOG,
  A2UI_WIDGET_TYPE,
  surfaceIdFor,
  column,
  row,
  card,
  text,
  divider,
  image,
  urlButton,
  buildA2uiSpec,
  validateComponents,
  bloksWidgetSupport,
  bloksWidgetFor,
};
