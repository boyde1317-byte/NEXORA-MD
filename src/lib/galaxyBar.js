/**
 * @file src/lib/galaxyBar.js
 * The galaxy bar as a container, not as copy.
 *
 * Menu 19 builds `messageParamsJson` inline, with the offer strip, the bottom
 * sheet and the tutorial callout fused into one hand-written object. That is
 * why the bar cannot be reused elsewhere: the shape and the words live in the
 * same expression.
 *
 * This module splits them. A bar is three known slots, each optional and each
 * empty until a caller supplies content:
 *
 *   limited_time_offer       the strip across the top of the sheet
 *   bottom_sheet             grouping, dividers and the sheet's own titles
 *   tap_target_configuration the first-open callout
 *
 * The rules that make it a container rather than a template:
 *
 *   - Nothing is invented. `buildGalaxyBar()` is `{}` — not a bar with blank
 *     strings, an empty bar. A release check asserts it carries no letters.
 *   - A slot with no keys is dropped, not emitted empty. `{}` inside a slot
 *     means "not supplied", while an explicit `''` means "deliberately blank"
 *     and is kept, because those two read differently on the client.
 *   - `undefined` and `null` are stripped at any depth, so optional fields can
 *     be passed through without guards at the call site.
 *   - `fillGalaxyBar` merges one level per slot, which is what lets a caller
 *     start from an empty bar and add only the slot they care about.
 *
 * The shape is the one galaxyMenu sends, so a filled bar works on either path.
 */

/** The three slots a galaxy bar can carry, in client render order. */
export const BAR_SLOTS = ['limited_time_offer', 'bottom_sheet', 'tap_target_configuration'];

/** Short names callers may use instead of the protocol names. */
export const SLOT_ALIASES = Object.freeze({
  offer: 'limited_time_offer',
  sheet: 'bottom_sheet',
  tap: 'tap_target_configuration',
  callout: 'tap_target_configuration',
});

/** An empty bar: valid, relayable, and entirely wordless. */
export const EMPTY_BAR = '{}';

/** Recursively drop undefined/null. */
function compact(value) {
  if (Array.isArray(value)) {
    return value
      .map(compact)
      .filter((v) => v !== undefined && v !== null);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || v === null) continue;
      out[k] = compact(v);
    }
    return out;
  }
  return value;
}

/** Resolve a slot name or alias to its protocol name, or null. */
export function resolveSlot(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().replace(/[\s-]+/g, '_');
  if (BAR_SLOTS.includes(key)) return key;
  const viaAlias = SLOT_ALIASES[key];
  return viaAlias && BAR_SLOTS.includes(viaAlias) ? viaAlias : null;
}

/** Pull one slot out of a fill object, accepting its aliases. */
function pickSlot(fill, slot) {
  if (fill[slot] !== undefined) return fill[slot];
  for (const [alias, target] of Object.entries(SLOT_ALIASES)) {
    if (target === slot && fill[alias] !== undefined) return fill[alias];
  }
  return undefined;
}

/**
 * Build a bar from supplied slots.
 *
 * @param {object} [fill] keys may be any slot name or alias
 * @returns {string} JSON ready for `nativeFlowMessage.messageParamsJson`
 */
export function buildGalaxyBar(fill = {}) {
  const bar = {};
  for (const slot of BAR_SLOTS) {
    const given = pickSlot(fill, slot);
    if (!given || typeof given !== 'object' || Array.isArray(given)) continue;
    const clean = compact(given);
    if (Object.keys(clean).length) bar[slot] = clean;
  }
  return JSON.stringify(bar);
}

/** Parse a bar back into an object. Anything unusable becomes an empty bar. */
export function parseGalaxyBar(bar) {
  if (!bar) return {};
  if (typeof bar === 'object') return bar;
  try {
    const parsed = JSON.parse(String(bar));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Fill slots into an existing bar without touching slots the patch omits.
 *
 * @param {string|object} bar the current bar
 * @param {object} patch slots (or aliases) to add or replace
 * @returns {string} JSON
 */
export function fillGalaxyBar(bar, patch = {}) {
  const current = parseGalaxyBar(bar);
  const next = { ...current };
  for (const slot of BAR_SLOTS) {
    const given = pickSlot(patch, slot);
    if (given === undefined) continue;
    if (given === null) { delete next[slot]; continue; }
    if (typeof given !== 'object' || Array.isArray(given)) continue;
    const merged = compact({ ...(next[slot] || {}), ...given });
    if (Object.keys(merged).length) next[slot] = merged;
    else delete next[slot];
  }
  return JSON.stringify(next);
}

/** Slot names present in a bar, in render order. */
export function barSlots(bar) {
  const parsed = parseGalaxyBar(bar);
  return BAR_SLOTS.filter((slot) => parsed[slot] && Object.keys(parsed[slot]).length > 0);
}

/** True when the bar carries no slots at all. */
export function barIsEmpty(bar) {
  return barSlots(bar).length === 0;
}

/** True when any slot carries human-readable text. Used by probes and tests. */
export function barHasCopy(bar) {
  const parsed = parseGalaxyBar(bar);
  const walk = (v) => {
    if (typeof v === 'string') return /[A-Za-z]/.test(v);
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === 'object') return Object.values(v).some(walk);
    return false;
  };
  return walk(parsed);
}


// ─────────────────────────────────────────────────────────────────────────────
// Shared probe material
// ─────────────────────────────────────────────────────────────────────────────

/** The carrier body menu 19 uses: one zero-width space, so only the bar shows. */
export const BAR_ZWSP = '\u200b';

/**
 * Blank slots: present in the bar, carrying no copy at all.
 *
 * Deliberately `''` rather than absent — this is the difference between "the
 * slot is supplied and empty" and "the slot was never supplied", and the whole
 * probe series exists to see which one the client reacts to.
 */
export const BLANK_SLOTS = Object.freeze({
  offer: Object.freeze({ text: '', url: '', copy_code: '', expiration_time: 0 }),
  sheet: Object.freeze({
    in_thread_buttons_limit: 0,
    divider_indices: [],
    list_title: '',
    button_title: ' ',
  }),
  tap: Object.freeze({
    title: '',
    description: '',
    canonical_url: '',
    domain: '',
    button_index: 0,
  }),
});

/** A native-flow URL button, the minimum anchor a bar needs to render against. */
export const ctaUrlButton = (display, url) => ({
  name: 'cta_url',
  buttonParamsJson: JSON.stringify({
    display_text: display,
    url,
    landing_page_url: url,
    webview_interaction: true,
  }),
});

/**
 * The carrier a bar rides on: viewOnce envelope, zero-width body, no footer.
 *
 * Pure — it returns the content object; the caller relays it. Both `.galaxybar`
 * and `.testrich` build their probes from here so a probe means the same thing
 * in either place.
 *
 * @param {object} [spec]
 * @param {string} [spec.bar] messageParamsJson
 * @param {Array}  [spec.buttons] nativeFlow buttons
 * @param {string} [spec.footer] omit for no footer at all
 * @param {object} [spec.header] defaults to no media
 * @returns {{viewOnceMessage: {message: {interactiveMessage: object}}}}
 */
export function buildBarCarrier({ bar = EMPTY_BAR, buttons = [], footer, header } = {}) {
  const interactiveMessage = {
    header: header || { hasMediaAttachment: false },
    body: { text: BAR_ZWSP },
    ...(footer ? { footer: { text: footer } } : {}),
    nativeFlowMessage: {
      messageParamsJson: bar,
      buttons,
      messageVersion: 1,
    },
  };
  return { viewOnceMessage: { message: { interactiveMessage } } };
}

// ─────────────────────────────────────────────────────────────────────────────
// The probe series — one source of truth for `.galaxybar` and `.testrich`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each probe isolates one question about the container.
 *
 * `bar` and `buttons` are thunks so the filled variants get a fresh expiry on
 * every send, and `arg` is the free text a caller may pass (offer copy).
 */
export const BAR_PROBES = Object.freeze([
  {
    id: 'barempty',
    label: 'Empty container',
    note: 'the bar as {} — no slots, no buttons',
    bar: () => EMPTY_BAR,
  },
  {
    id: 'baroffer',
    label: 'Offer strip, blank',
    note: 'limited_time_offer present, every field empty',
    bar: () => buildGalaxyBar({ offer: BLANK_SLOTS.offer }),
  },
  {
    id: 'barsheet',
    label: 'Bottom sheet, blank',
    note: 'bottom_sheet present, titles empty',
    bar: () => buildGalaxyBar({ sheet: BLANK_SLOTS.sheet }),
  },
  {
    id: 'bartap',
    label: 'Tap callout, blank',
    note: 'tap_target_configuration present, copy empty',
    bar: () => buildGalaxyBar({ tap: BLANK_SLOTS.tap }),
  },
  {
    id: 'barall',
    label: 'All three slots, blank',
    note: 'every slot present, nothing written in them',
    bar: () => buildGalaxyBar(BLANK_SLOTS),
  },
  {
    id: 'barfill',
    label: 'Offer filled',
    note: 'same strip with copy, plus one CTA to anchor it',
    bar: (arg) => buildGalaxyBar({
      offer: {
        text: arg || 'Boarding now',
        url: 'https://example.com',
        copy_code: 'NX-1',
        expiration_time: Date.now() + 86400000,
      },
    }),
    buttons: () => [ctaUrlButton('Open', 'https://example.com')],
  },
  {
    id: 'barone',
    label: 'Empty container, one CTA',
    note: 'does the chrome show with nothing to describe?',
    bar: () => EMPTY_BAR,
    buttons: () => [ctaUrlButton('Open', 'https://example.com')],
  },
  {
    id: 'bargrow',
    label: 'Grown from empty',
    note: 'starts as {}, fills only the offer — the grow path',
    bar: (arg) => fillGalaxyBar(EMPTY_BAR, { offer: { text: arg || 'Boarding now' } }),
  },
]);

/** Find a probe by id (case-insensitive). */
export function getBarProbe(id) {
  const key = String(id || '').trim().toLowerCase();
  return BAR_PROBES.find((probe) => probe.id === key) || null;
}

/**
 * Turn a probe into send-ready material.
 *
 * @returns {{id,label,bar,buttons}} resolved values
 */
export function resolveBarProbe(probe, arg = '') {
  return {
    id: probe.id,
    label: probe.label,
    bar: probe.bar(arg),
    buttons: probe.buttons ? probe.buttons() : [],
  };
}

export default {
  BAR_SLOTS,
  SLOT_ALIASES,
  EMPTY_BAR,
  resolveSlot,
  buildGalaxyBar,
  parseGalaxyBar,
  fillGalaxyBar,
  barSlots,
  barIsEmpty,
  barHasCopy,
  BAR_ZWSP,
  BLANK_SLOTS,
  ctaUrlButton,
  buildBarCarrier,
  BAR_PROBES,
  getBarProbe,
  resolveBarProbe,
};
