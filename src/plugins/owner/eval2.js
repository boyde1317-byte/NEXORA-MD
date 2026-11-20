/**
 * eval2.js — owner-only JavaScript eval (second variant).
 *
 *   .eval2 <js code>   run JS with the socket, message and helpers in scope
 *
 * Ported from the LUNA MD owner-exec.js plugin. NexoraFlex already ships
 * .eval (src/plugins/owner/eval.js, vm-sandboxed), so this variant is
 * .eval2 and never shadows it. It keeps the LUNA behaviour: a raw
 * AsyncFunction eval with a `deepFix` wrapper that strips dead WhatsApp
 * media URLs and bottom-sheet params from relayed messages, plus the
 * `print` helper that replies with formatted output.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-exec.js):
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, owner gating via
 *     `permissions: { owner: true }` instead of a handler.owner flag.
 *   - The LUNA custom prefix (`> ` / `=> `) cannot exist in NexoraFlex:
 *     the dispatcher matches by command name/alias only, so this is a
 *     normal command — `.eval2 <code>`. A leading `>` / `=>` in the code
 *     is still stripped, as the original did.
 *   - `noPrefix` (the raw message text minus prefix) is gone; the code
 *     is `args.join(' ')`.
 *   - The `syntax-error` package is not installed in NexoraFlex, so the
 *     annotated-syntax-error block is dropped; caught errors are replied
 *     as plain formatted text.
 *   - `m.exp` preservation is dropped (NexoraFlex users carry `xp` on
 *     the db record, not on the message object).
 *   - `groupMetadata` comes from `sock.groupMetadata(m.from)` when in a
 *     group, instead of the LUNA handler context.
 */
import { format } from 'node:util';
import { createRequire } from 'node:module';
import * as baileys from 'baileys';
import { generateWAMessageFromContent, generateWAMessage } from 'baileys';

const require = createRequire(import.meta.url);

// Fixes any message so it works without a WhatsApp update
function deepFix(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepFix);
  const out = { ...obj };
  // 1 - Remove the dead image URLs
  if (out.imageMessage?.url?.includes('mmg.whatsapp.net')) delete out.imageMessage.url;
  if (out.videoMessage?.url?.includes('mmg.whatsapp.net')) delete out.videoMessage.url;
  if (out.documentMessage?.url?.includes('mmg.whatsapp.net')) delete out.documentMessage.url;
  // 2 - Remove bottom_sheet which triggers an update prompt
  if (out.nativeFlowMessage?.messageParamsJson) {
    try {
      const p = JSON.parse(out.nativeFlowMessage.messageParamsJson);
      if (p.bottom_sheet) {
        // Keep it as a simple list so it works on any WhatsApp
        p.bottom_sheet = undefined;
        out.nativeFlowMessage.messageParamsJson = JSON.stringify(p);
      }
    } catch {}
  }
  // 3 - Remove empty messageContextInfo
  if (out.messageContextInfo && Object.keys(out.messageContextInfo).length === 0) delete out.messageContextInfo;
  for (const k in out) if (out[k] && typeof out[k] === 'object') out[k] = deepFix(out[k]);
  return out;
}

export default {
  name: 'eval2',
  aliases: [],
  category: 'owner',
  description: 'Run JavaScript with the socket in scope (raw eval with deepFix relay wrapper). Owner only.',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, sock, args }) => {
    let _return;
    let _text = args.join(' ').trim();

    // Strip the > and => prefixes that come from crm
    _text = _text.replace(/^>\s*/, '').replace(/^=>\s*/, '').trim();
    if (!/^return/.test(_text) && /sock\.(relayMessage|sendMessage)/.test(_text)) {
      // If it is a full crm code without return, add one
      if (!/return/.test(_text.slice(-100))) _text = 'return ' + _text;
    }
    if (/^sock\.relayMessage/.test(_text.trim())) {
      _text = 'return ' + _text.trim();
    }
    // Accept the old conn.* spelling too — the relay snippets crm3 hands
    // out still say conn, and the eval scope below binds conn = sock.
    if (!/^return/.test(_text) && /conn\.(relayMessage|sendMessage)/.test(_text)) {
      if (!/return/.test(_text.slice(-100))) _text = 'return ' + _text;
    }
    if (/^conn\.relayMessage/.test(_text.trim())) {
      _text = 'return ' + _text.trim();
    }

    if (!_text) return await m.reply.error('No code provided. Usage: .eval2 <javascript>');

    let groupMetadata = null;
    if (m.isGroup) {
      try { groupMetadata = await sock.groupMetadata(m.from); } catch (_) {}
    }

    try {
      const f = { exports: {} };
      const conn = sock;
      const execFn = new (async () => {}).constructor(
        'print', 'm', 'require', 'conn', 'sock', 'baileys', 'groupMetadata', 'generateWAMessageFromContent', 'generateWAMessage', 'deepFix', 'module', 'exports', 'args', 'argument', _text
      );
      _return = await execFn.call(
        conn,
        (...a) => { console.log(...a); return sock.sendMessage(m.from, { text: format(...a) }, { quoted: m }); },
        m,
        require,
        conn,
        sock,
        baileys,
        groupMetadata,
        async (jid, content, opts = {}) => {
          // Wrapper that automatically fixes the message
          const fixed = deepFix(content);
          const waMsg = await generateWAMessageFromContent(jid, fixed, { quoted: m, ...opts });
          return sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id, ...opts });
        },
        generateWAMessage,
        deepFix,
        f,
        f.exports,
        args,
        [conn, { conn }]
      );
    } catch (e) {
      _return = e;
    } finally {
      if (_return == null) _return = '✅ Done - Message sent';
      if (_return?.key?.id || (typeof _return === 'string' && _return.length === 20)) {
        // If it returned a message ID
        await sock.sendMessage(m.from, { text: `✅ Relay ID: ${_return?.key?.id || _return}` }, { quoted: m });
      } else {
        await sock.sendMessage(m.from, { text: format(_return).slice(0, 4000) }, { quoted: m });
      }
    }
  },
};
