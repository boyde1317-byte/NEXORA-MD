/**
 * crm3.js — owner-only relay-message inspector (JSON + JS modes).
 *
 *   .crm3    reply to a message -> relay.js document (JSON payload)
 *   .crm3js  reply to a message -> relays it live + sends the runnable
 *            relay snippet as a .js document
 *
 * Ported from the LUNA MD owner-crm.js plugin. The two LUNA modes are kept,
 * but the command names are new: NexoraFlex already ships .crm / .crm2
 * (src/plugins/owner/crm.js), so this variant is .crm3 / .crm3js and never
 * shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-crm.js):
 *   - `satanic` -> `sock`, `m.chat` -> `m.from`, owner gating via
 *     `permissions: { owner: true }` instead of an isCreator check.
 *   - The relay-code file is no longer written to a ./debug folder on
 *     disk; the .js document is sent from a Buffer instead.
 *   - `global.config?.botname` / 'LUNA MD' -> 'NEXORA MD'; the payload
 *     type is 'nexora-crm-relay'.
 *   - The `global.sendAdminLog` error hook is gone (no such global here);
 *     errors are logged to console and replied to the owner.
 *   - `m.quoted.quoted` (LUNA serializer nesting) is dropped; the quoted
 *     payload comes from `m.quoted.message || m.quoted.msg` (the shape
 *     NexoraFlex's serializer provides) with the contextInfo fallback.
 */
import { generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';

function unwrap(content) {
  if (!content || typeof content !== 'object') return content;
  if (content.ephemeralMessage?.message) return unwrap(content.ephemeralMessage.message);
  if (content.viewOnceMessage?.message) return unwrap(content.viewOnceMessage.message);
  if (content.viewOnceMessageV2?.message) return unwrap(content.viewOnceMessageV2.message);
  if (content.viewOnceMessageV2Extension?.message) return unwrap(content.viewOnceMessageV2Extension.message);
  if (content.documentWithCaptionMessage?.message) return unwrap(content.documentWithCaptionMessage.message);
  return content;
}

function normalizeForRelay(rawContent) {
  const content = unwrap(rawContent);
  if (typeof content?.conversation === 'string') {
    const { conversation, ...rest } = content;
    return { ...rest, extendedTextMessage: { text: conversation } };
  }
  return content;
}

function toJsLiteral(value, indent = 2, seen = new WeakSet(), depth = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return JSON.stringify(Buffer.from(value).toString('base64'));
  }
  if (typeof value !== 'object') return JSON.stringify(value);
  if (depth > 40) return '"[MaxDepth]"';
  if (seen.has(value)) return '"[Circular]"';
  seen.add(value);
  const pad = ' '.repeat(indent);
  const padClose = ' '.repeat(Math.max(indent - 2, 0));
  let result;
  if (Array.isArray(value)) {
    if (!value.length) {
      result = '[]';
    } else {
      const items = value.map((v) => pad + toJsLiteral(v, indent + 2, seen, depth + 1));
      result = `[\n${items.join(',\n')}\n${padClose}]`;
    }
  } else {
    const keys = Object.keys(value).filter((k) => typeof value[k] !== 'function' && value[k] !== undefined);
    if (!keys.length) {
      result = '{}';
    } else {
      const lines = keys.map((k) => {
        const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return `${pad}${keyStr}: ${toJsLiteral(value[k], indent + 2, seen, depth + 1)}`;
      });
      result = `{\n${lines.join(',\n')}\n${padClose}}`;
    }
  }
  seen.delete(value);
  return result;
}

const FRAMEWORK_DECORATED_KEYS = new Set([
  'mtype', 'id', 'chat', 'isBaileys', 'sender', 'fromMe', 'mentionedJid',
  'fakeObj', 'delete', 'copyNForward', 'download', 'key', 'participant',
  'text', 'body', 'name', 'pushName', 'viewonce', 'download1',
]);

function stripFrameworkProps(content) {
  if (!content || typeof content !== 'object') return content;
  const out = {};
  for (const k of Object.keys(content)) {
    if (FRAMEWORK_DECORATED_KEYS.has(k)) continue;
    if (typeof content[k] === 'function') continue;
    out[k] = content[k];
  }
  return out;
}

function buildReadableSendCode(content) {
  try {
    const clean = stripFrameworkProps(content);
    return `sock.relayMessage(\n  m.from,\n  ${toJsLiteral(clean)},\n  {}\n)`;
  } catch (err) {
    return `// Failed to generate relay_code: ${err?.message || err}`;
  }
}

function typeNameFromContent(content) {
  const clean = stripFrameworkProps(content);
  const key = Object.keys(clean)[0] || 'UnknownMessage';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function crmHasViewOnce(obj, visited = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return false;
  if (visited.has(obj)) return false;
  visited.add(obj);
  if (obj.viewOnceMessage || obj.viewOnceMessageV2 || obj.viewOnceMessageV2Extension) {
    return true;
  }
  for (const value of Object.values(obj)) {
    if (crmHasViewOnce(value, visited)) return true;
  }
  return false;
}

export default {
  name: 'crm3',
  aliases: ['crm3js'],
  category: 'owner',
  description: 'Reply to a message to get its relay payload: .crm3 (JSON file) or .crm3js (live relay + JS file). Owner only.',
  permissions: { owner: true },
  cooldown: 1500,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const command = String(commandName || 'crm3').toLowerCase();

    if (!m.quoted) {
      return m.reply(
        `⚠️ *How to use:*\n\n` +
        `Reply to the message you want to relay, then send *${p}${command}*\n\n` +
        `📌 Example: Reply to a button/list/location message then type ${p}crm3\n\n` +
        `📌 Modes:\n` +
        `• ${p}crm3 - JSON mode (relay.js file)\n` +
        `• ${p}crm3js - JS mode (live relay + .js file)`
      );
    }

    if (crmHasViewOnce(m.quoted)) {
      return m.reply('❌ View-once messages cannot be saved.');
    }

    try {
      const quotedMsg = m.quoted;
      const rawQuoted = quotedMsg.message || quotedMsg.msg || m.msg?.contextInfo?.quotedMessage;

      if (!rawQuoted || typeof rawQuoted !== 'object' || !Object.keys(rawQuoted).length) {
        return m.reply('❌ There is no message that can be relayed.');
      }

      const unwrapped = unwrap(rawQuoted);

      if (!unwrapped || typeof unwrapped !== 'object' || !Object.keys(unwrapped).length) {
        return m.reply('❌ This message type is not supported for relay yet.');
      }

      let fullData = {};
      let messageType = 'unknown';
      let hasButtons = false;
      let buttonData = null;
      let locationData = null;

      if (quotedMsg.message || quotedMsg.msg) {
        fullData = quotedMsg.message || quotedMsg.msg;
        const keys = Object.keys(fullData);
        if (keys.length > 0) {
          messageType = keys[0];
          if (messageType === 'buttonsMessage') {
            hasButtons = true;
            buttonData = fullData[messageType];
            if (buttonData.locationMessage) locationData = buttonData.locationMessage;
          }
        }
      }

      const isCrm3js = command === 'crm3js';

      if (isCrm3js) {
        const relayContent = normalizeForRelay(rawQuoted);
        const relayMsg = generateWAMessageFromContent(m.from, relayContent, {
          messageId: generateMessageIDV2(),
          userJid: sock.user?.id,
        });
        await sock.relayMessage(relayMsg.key.remoteJid, relayMsg.message, {
          messageId: relayMsg.key.id,
        });
        const typeName = typeNameFromContent(unwrapped);
        const filename = `${typeName}.js`;
        const code = buildReadableSendCode(unwrapped);
        await sock.sendMessage(
          m.from,
          {
            document: Buffer.from(code, 'utf-8'),
            fileName: filename,
            mimetype: 'text/javascript',
            caption: `✅ *Relay successful (CRM3JS)*\n\n📄 ${filename}\n📝 Type: ${typeName}`,
          },
          { quoted: m }
        );
      } else {
        const crmPayload = {
          key: quotedMsg.key || {},
          sender: quotedMsg.sender || m.sender,
          timestamp: quotedMsg.timestamp || Date.now(),
          text: quotedMsg.text || quotedMsg.body || '',
          caption: quotedMsg.caption || '',
          type: messageType,
          hasButtons,
          hasLocation: !!locationData,
          fullData,
          buttonData,
          locationData,
          rawMessage: fullData,
        };

        const crmData = {
          type: 'nexora-crm-relay',
          version: 2,
          createdAt: new Date().toISOString(),
          creator: 'NEXORA MD',
          payload: crmPayload,
        };

        const crmCode = `module.exports = ${JSON.stringify(crmData, null, 2)};\n`;

        let infoText = `✅ *CRM created successfully (JSON)*\n\n`;
        infoText += `📝 Type: ${messageType}\n`;
        infoText += `🔘 Button: ${hasButtons ? '✅ Yes' : '❌ No'}\n`;
        if (locationData) {
          infoText += `📍 Location: ${locationData.name || 'Available'}\n`;
        }
        infoText += `📅 Time: ${crmData.createdAt}\n\n`;
        infoText += `Reply to this file and send:\n`;
        infoText += `*${p}runcrm*`;

        await sock.sendMessage(
          m.from,
          {
            document: Buffer.from(crmCode),
            mimetype: 'application/javascript',
            fileName: 'relay.js',
            caption: infoText,
          },
          { quoted: m }
        );
      }

      await sock.sendMessage(m.from, {
        react: { text: '✅', key: m.key },
      });
    } catch (e) {
      console.error('[crm3] error:', e);
      return m.reply(
        '❌ Failed to create CRM.\n\n' +
        (e?.message || String(e))
      );
    }
  },
};
