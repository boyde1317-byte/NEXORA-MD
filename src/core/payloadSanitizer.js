/**
 * payloadSanitizer.js — inbound WhatsApp crash-payload sanitizer.
 *
 * Background: "bug bot" scripts (OchoVoid, Ryukisan-family, etc.) weaponize
 * the WhatsApp protocol by sending structurally valid messages with absurd
 * field values. The receiving client (not the bot) chokes on them:
 *
 *   - `nativeFlowMessage.buttons` arrays with 500,000 empty entries
 *     (renderer walks the whole array per paint)
 *   - `nativeFlowResponseMessage.buttons` with 20,002 entries
 *   - media metadata lies: `fileLength: 999999999` / "109951162777600"
 *     (~100 TB), `scanLengths: [1e19, ...]`, `pageCount: 1000`,
 *     `height: -9999, width: 9999`
 *   - text floods: NUL runs (`"\0".repeat(500000)` in buttons params,
 *     `order_id: "\0".repeat(100000)` in Flows buttonParamsJson),
 *     zero-width space runs (`"\u200b".repeat(10000)`)
 *   - `locationMessage` with `degreesLatitude/Longitude: 9999999999`
 *
 * Everything arrives inside ordinary message containers
 * (interactiveMessage, groupStatusMessageV2, viewOnce, ephemeral, etc.), so
 * detection is a bounded deep walk over the whole message object with
 * value-based rules — not container matching. Any message that trips a rule
 * is dropped before it reaches handleMessage or the message store, so
 * poisoned payloads never sit in memory or reach plugin code.
 *
 * The walker itself is hardened: depth-capped and node-capped, because a
 * sanitizer that can be OOM'd by its own input is not a sanitizer.
 */

// ── Bounds (generous enough for every legitimate WhatsApp message we've
//    seen; a real message never comes close to any of these) ──────────────
const MAX_BUTTONS = 256;          // nativeFlow buttons array length
const MAX_PARAMS_JSON = 65536;    // buttonParamsJson size (bytes)
const MAX_STRING = 65536;         // any single string field (64 KiB)
const MAX_FILE_LENGTH = 4294967296;      // 4 GiB declared media size
const MAX_SCAN_LENGTH = 1000000000;      // scanLengths entry
const MAX_SCAN_ENTRIES = 8;              // scanLengths array length
const MAX_PAGE_COUNT = 5000;             // document pageCount
const MAX_DIMENSION = 100000;            // image/video width or height
const MAX_WALK_DEPTH = 25;               // object nesting depth
const MAX_WALK_NODES = 20000;            // total nodes inspected per message
const ZERO_WIDTH_RUN = /[\u200b\u200c\u200d\u2060\ufeff]{32,}/;
const NUL = /\0/;                        // no legitimate WA string contains NUL

/** Module-level counters, for the Telegram panel / health endpoints. */
export const sanitizerStats = {
  dropped: 0,
  byRule: {},
  lastDropped: null,   // { at, source, jid, reasons }
};

function bump(rule) {
  sanitizerStats.dropped += 1;
  sanitizerStats.byRule[rule] = (sanitizerStats.byRule[rule] || 0) + 1;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Numbers can arrive as number or numeric string ("109951162777600"). */
function asNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v);
  return NaN;
}

function checkNumericField(key, value, violations, path) {
  const n = asNumber(value);
  if (Number.isNaN(n)) return; // non-numeric form; string rules cover abuse
  if (key === 'fileLength' && n > MAX_FILE_LENGTH) {
    violations.push(`${path}.fileLength=${n} (declared media size > 4 GiB)`);
  } else if (key === 'pageCount' && n > MAX_PAGE_COUNT) {
    violations.push(`${path}.pageCount=${n}`);
  } else if ((key === 'height' || key === 'width') && (n < 0 || n > MAX_DIMENSION)) {
    violations.push(`${path}.${key}=${n}`);
  } else if (key === 'degreesLatitude' && Math.abs(n) > 90) {
    violations.push(`${path}.degreesLatitude=${n}`);
  } else if (key === 'degreesLongitude' && Math.abs(n) > 180) {
    violations.push(`${path}.degreesLongitude=${n}`);
  }
}

function checkStringField(value, violations, path) {
  if (value.length > MAX_STRING) {
    violations.push(`${path} string length ${value.length} > ${MAX_STRING}`);
    return;
  }
  if (NUL.test(value)) {
    violations.push(`${path} contains NUL byte`);
  } else if (ZERO_WIDTH_RUN.test(value)) {
    violations.push(`${path} contains zero-width run`);
  }
}

/**
 * Bounded deep walk. Collects human-readable violations; never throws.
 */
function walk(node, path, depth, violations, state) {
  if (state.nodes >= MAX_WALK_NODES || depth > MAX_WALK_DEPTH) {
    violations.push(`${path} exceeds walk limits (depth=${depth})`);
    return;
  }
  state.nodes += 1;

  if (Array.isArray(node)) {
    // The killer array: native flow buttons. Real messages have a handful.
    if (path.endsWith('.buttons') && node.length > MAX_BUTTONS) {
      violations.push(`${path}.length=${node.length} > ${MAX_BUTTONS}`);
      return; // nothing else inside matters
    }
    if (path.endsWith('.scanLengths')) {
      if (node.length > MAX_SCAN_ENTRIES) {
        violations.push(`${path}.length=${node.length} > ${MAX_SCAN_ENTRIES}`);
      }
      for (let i = 0; i < Math.min(node.length, MAX_SCAN_ENTRIES); i++) {
        const n = asNumber(node[i]);
        if (!Number.isNaN(n) && n > MAX_SCAN_LENGTH) {
          violations.push(`${path}[${i}]=${n} > ${MAX_SCAN_LENGTH}`);
        }
      }
      return;
    }
    for (let i = 0; i < node.length; i++) {
      walk(node[i], `${path}[${i}]`, depth + 1, violations, state);
      if (violations.length >= 8) return; // enough evidence; stop early
    }
    return;
  }

  if (isPlainObject(node)) {
    for (const key of Object.keys(node)) {
      const value = node[key];
      const childPath = `${path}.${key}`;
      if (typeof value === 'number' || typeof value === 'string') {
        if (key === 'buttonParamsJson' && typeof value === 'string' && value.length > MAX_PARAMS_JSON) {
          violations.push(`${childPath} length ${value.length} > ${MAX_PARAMS_JSON}`);
        } else if (typeof value === 'string') {
          checkStringField(value, violations, childPath);
        } else {
          checkNumericField(key, value, violations, childPath);
        }
      } else if (value && typeof value === 'object') {
        walk(value, childPath, depth + 1, violations, state);
      }
      if (violations.length >= 8) return;
    }
  }
  // primitives at this level are covered by their parent key above
}

/**
 * Inspect one baileys message. Returns { crash, reasons }.
 * crash=true means the message should be dropped, not processed.
 */
export function inspectMessage(message) {
  const violations = [];
  try {
    if (message && typeof message === 'object') {
      walk(message, 'message', 0, violations, { nodes: 0 });
    } else {
      violations.push('message is not an object');
    }
  } catch (err) {
    // Walk failure on malformed input is itself suspicious — drop.
    violations.push(`walker error: ${err.message}`);
  }
  return { crash: violations.length > 0, reasons: violations };
}

/**
 * Filter an upsert batch. Returns only clean messages; logs and counts
 * every dropped one. Never throws.
 *
 * @param {Array} messages  raw chatUpdate.messages
 * @param {string} source   label for logs ('main' or `+<phone>`)
 * @returns {Array} messages safe to handle/store
 */
export function filterCrashPayloads(messages, source = 'main') {
  if (!Array.isArray(messages)) return [];
  const clean = [];
  for (const message of messages) {
    const verdict = inspectMessage(message);
    if (!verdict.crash) {
      clean.push(message);
      continue;
    }
    bump(verdict.reasons[0].split(' ')[0]);
    const jid = message?.key?.remoteJid || 'unknown';
    console.warn(
      `[SANITIZER] dropped crash payload from ${jid} (${source}): ${verdict.reasons.join('; ')}`
    );
    sanitizerStats.lastDropped = {
      at: new Date().toISOString(),
      source,
      jid,
      reasons: verdict.reasons,
    };
  }
  return clean;
}
