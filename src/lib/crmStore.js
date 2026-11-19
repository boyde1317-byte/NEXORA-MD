/**
 * crmStore.js — the message archive behind `.crm` / `.insp` / `.adn` / `.relay`.
 *
 * Ported from the Rem Bot / YONO DEV "crm" (lib/crmstore.js + plugins/crm.js).
 * It is not a customer database: it is an archive of everything the bot sent,
 * received and saw on the wire, so an owner can reply to any message and get its
 * payload back — including messages that were edited or deleted afterwards.
 *
 * What it keeps, per message id:
 *   - the decoded WebMessageInfo (protobuf, base64 in the log)
 *   - the raw stanza node when we saw it (sock.ws 'CB:message'), buffers base64'd
 *
 * Storage is an append-only JSONL per chat under data/crm/, with an in-memory
 * index for reads. No new dependency: better-sqlite3 is not in this bot, and
 * node:sqlite is not available on every runtime we deploy to.
 *
 * The interesting part is decryptSecretEnvelope(): WhatsApp sends edits and
 * deletions as `secretEncryptedMessage` (AES-256-GCM, key = HKDF of the TARGET
 * message's messageSecret). Because the archive kept that secret, an edited or
 * deleted message can be recovered and shown.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { proto } from 'baileys';

const DIR = path.join(process.cwd(), 'data', 'crm');
const MAX_MESSAGES = 4000;
const MAX_NODES = 1500;

/** id → { chat, ts, sender, b64 } */
const messages = new Map();
/** `${id}|${chat}` → node */
const nodes = new Map();
/** chat → [id, …] newest last, so `.lastchat` is a lookup not a scan */
const byChat = new Map();

let ready = false;

const safeName = (jid) => String(jid || 'unknown').replace(/[^a-zA-Z0-9._@-]/g, '_').slice(0, 120);

function append(file, record) {
  try {
    fs.appendFileSync(path.join(DIR, file), `${JSON.stringify(record)}\n`);
  } catch (err) {
    if (process.env.CRM_DEBUG) console.warn('[crmStore] write failed:', err.message);
  }
}

/** Buffers/Uint8Array → base64 so a node survives JSON. */
const encode = (value) => JSON.stringify(value, (_k, v) => {
  if (Buffer.isBuffer(v)) return { __buf: v.toString('base64') };
  if (v instanceof Uint8Array) return { __buf: Buffer.from(v).toString('base64') };
  return v;
});

// Buffer.toJSON() runs BEFORE the replacer, so buffers come back as
// { type: 'Buffer', data: [...] } — the reviver has to rebuild both shapes.
const decode = (text) => JSON.parse(text, (_k, v) => {
  if (!v || typeof v !== 'object') return v;
  if (typeof v.__buf === 'string') return Buffer.from(v.__buf, 'base64');
  if (v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
  return v;
});

/** Load the archive into memory once per process. */
export function initCrmStore() {
  if (ready) return { messages: messages.size, nodes: nodes.size };
  ready = true;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl'))) {
      const body = fs.readFileSync(path.join(DIR, file), 'utf-8');
      for (const line of body.split('\n')) {
        if (!line) continue;
        let rec;
        try { rec = JSON.parse(line); } catch { continue; }
        if (rec.type === 'message') {
          messages.set(rec.id, rec);
          const list = byChat.get(rec.chat) || [];
          list.push(rec.id);
          byChat.set(rec.chat, list);
        }
        else if (rec.type === 'node') nodes.set(`${rec.id}|${rec.chat}`, rec);
      }
    }
  } catch (err) {
    console.warn('[crmStore] init failed:', err.message);
  }
  return { messages: messages.size, nodes: nodes.size };
}

function evict(map, cap) {
  while (map.size > cap) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

/** Keep a WebMessageInfo (accepts a decoded message or a proto object). */
export function saveMessage(message, chat) {
  const id = message?.key?.id;
  const jid = chat || message?.key?.remoteJid;
  if (!id || !jid) return false;
  try {
    const info = proto.WebMessageInfo.fromObject(message);
    const b64 = Buffer.from(proto.WebMessageInfo.encode(info).finish()).toString('base64');
    const rec = {
      type: 'message',
      id,
      chat: jid,
      sender: info.participant || info.key?.participant || null,
      ts: Number(info.messageTimestamp || Math.floor(Date.now() / 1000)),
      b64,
    };
    messages.set(id, rec);
    const list = byChat.get(jid) || [];
    list.push(id);
    if (list.length > 200) list.splice(0, list.length - 200);
    byChat.set(jid, list);
    evict(messages, MAX_MESSAGES);
    append(`${safeName(jid)}.jsonl`, rec);
    return true;
  } catch {
    return false;
  }
}

/** Read a WebMessageInfo back. `chat` narrows the lookup. */
export function loadMessage(id, chat) {
  if (!id) return null;
  const rec = messages.get(id);
  if (!rec || (chat && rec.chat !== chat)) return null;
  try {
    return proto.WebMessageInfo.decode(Buffer.from(rec.b64, 'base64'));
  } catch {
    return null;
  }
}

/** Keep a raw stanza node (sock.ws 'CB:message'). */
export function saveNode(id, chat, node) {
  if (!id || !chat || !node) return false;
  const rec = { type: 'node', id: String(id), chat: String(chat), ts: Math.floor(Date.now() / 1000), node: encode(node) };
  nodes.set(`${rec.id}|${rec.chat}`, rec);
  evict(nodes, MAX_NODES);
  append(`${safeName(chat)}.jsonl`, rec);
  return true;
}

/** Read a raw node back, by id + chat, falling back to id alone. */
export function loadNode(id, chat) {
  if (!id) return null;
  const rec = (chat && nodes.get(`${id}|${chat}`)) || nodes.get(`${id}|${chat || ''}`)
    || [...nodes.values()].find((n) => n.id === String(id));
  if (!rec) return null;
  try {
    return decode(rec.node);
  } catch {
    return null;
  }
}

/** Newest archived ids for one chat (`.lastchat`). */
export function recentIds(chat, limit = 10) {
  const list = byChat.get(chat) || [];
  return list.slice(-limit).reverse();
}

/** Cheap counters for `.crmstats`. */
export const crmStats = () => ({ messages: messages.size, nodes: nodes.size, dir: DIR });

// ─── secret edits / deletions ────────────────────────────────────────────────

const SECRET_CONTEXT = {
  MESSAGE_EDIT: 'Message Edit',
  EVENT_EDIT: 'Event Edit',
  POLL_EDIT: 'Poll Edit',
  POLL_ADD_OPTION: 'Poll Edit',
};

const encTypeName = (value) => {
  if (typeof value === 'string') return value;
  try {
    return proto.Message.SecretEncryptedMessage.SecretEncType[value] ?? value;
  } catch {
    return value;
  }
};

/** Walk a message tree for the first messageSecret it carries. */
function findMessageSecret(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return null;
  if (node.messageContextInfo?.messageSecret) return node.messageContextInfo.messageSecret;
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = findMessageSecret(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recover the plaintext of a `secretEncryptedMessage`.
 * @param {object} secret  the secretEncryptedMessage
 * @param {Buffer} messageSecret  the TARGET message's 32-byte secret
 * @param {string} senderJid  the target's sender jid
 * @param {string} targetId  the target message id
 * @returns {object|null} the decoded Message, or null when it cannot be opened
 */
export function decryptSecret(secret, messageSecret, senderJid, targetId) {
  try {
    const type = encTypeName(secret?.secretEncType);
    const context = SECRET_CONTEXT[type];
    if (!context || !messageSecret || messageSecret.length !== 32) return null;
    const info = Buffer.concat([
      Buffer.from(targetId, 'utf8'),
      Buffer.from(senderJid, 'utf8'),
      Buffer.from(senderJid, 'utf8'),
      Buffer.from(context, 'utf8'),
    ]);
    const key = Buffer.from(crypto.hkdfSync('sha256', messageSecret, Buffer.alloc(0), info, 32));
    const payload = Buffer.from(secret.encPayload || '', 'base64');
    const iv = Buffer.from(secret.encIv || '', 'base64');
    if (iv.length !== 12 || payload.length < 17) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(payload.subarray(-16));
    const plain = Buffer.concat([decipher.update(payload.subarray(0, -16)), decipher.final()]);
    return proto.Message.toObject(proto.Message.decode(plain), { enums: Number, longs: Number, bytes: String, defaults: false });
  } catch {
    return null;
  }
}

/** If `message` is a secret edit/deletion, return the recovered message instead. */
export function decryptSecretEnvelope(message) {
  const secret = message?.message?.secretEncryptedMessage;
  if (!secret) return message;
  const targetKey = secret.targetMessageKey;
  if (!targetKey?.id) return message;
  const target = loadMessage(targetKey.id, message.key?.remoteJid);
  if (!target) return message;
  const targetObj = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(target), {
    enums: Number, longs: Number, bytes: String, defaults: false,
  });
  const secretB64 = findMessageSecret(targetObj.message);
  if (!secretB64) return message;
  const senderJid = targetObj.key?.participant || targetKey.participant
    || targetObj.key?.remoteJid || targetKey.remoteJid;
  if (!senderJid) return message;
  const plain = decryptSecret(secret, Buffer.from(secretB64, 'base64'), senderJid, targetKey.id);
  if (!plain) return message;
  return { ...message, message: plain, __decryptedFrom: targetKey.id };
}

// ─── socket binding ─────────────────────────────────────────────────────────

const bound = new WeakSet();

/**
 * Archive everything this socket sees and sends.
 * Safe to call more than once per socket.
 */
export function bindCrmStore(sock) {
  if (!sock || bound.has(sock)) return sock;
  bound.add(sock);
  initCrmStore();

  try {
    sock.ev.on('messages.upsert', ({ messages: batch }) => {
      for (const msg of batch || []) {
        if (msg?.key?.id && msg?.key?.remoteJid) saveMessage(msg, msg.key.remoteJid);
      }
    });
  } catch { /* not a real socket in tests */ }

  try {
    sock.ws?.on?.('CB:message', (node) => {
      const id = node?.attrs?.id;
      const chat = node?.attrs?.from || node?.attrs?.to || node?.attrs?.recipient || node?.attrs?.participant;
      if (id && chat) saveNode(id, chat, node);
    });
  } catch { /* ignore */ }

  for (const method of ['sendMessage', 'relayMessage']) {
    const original = sock[method];
    if (typeof original !== 'function' || original.__crmPatched) continue;
    const patched = async function patchedSend(jid, content, options = {}) {
      const result = await original.call(this, jid, content, options);
      try {
        const id = result?.key?.id || options.messageId;
        if (id) {
          const asInfo = result?.message
            ? { key: result.key || { id, remoteJid: jid }, message: result.message, messageTimestamp: Math.floor(Date.now() / 1000) }
            : { key: { id, remoteJid: jid }, message: content, messageTimestamp: Math.floor(Date.now() / 1000) };
          saveMessage(asInfo, jid);
        }
      } catch { /* archiving must never break a send */ }
      return result;
    };
    patched.__crmPatched = true;
    sock[method] = patched;
  }

  return sock;
}

export default { initCrmStore, bindCrmStore, saveMessage, loadMessage, saveNode, loadNode, recentIds, crmStats, decryptSecret, decryptSecretEnvelope };
