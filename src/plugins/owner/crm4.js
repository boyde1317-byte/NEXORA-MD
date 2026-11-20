/**
 * crm4.js — owner-only relay-message inspector (JSON + JS + raw modes).
 *
 *   .crm4       reply to a message -> relay.js document (relay snippet)
 *   .crm4btn    reply to a message -> buttons card with copy buttons
 *   .insp4      reply to a message -> raw payload (AIRich snip or .json doc)
 *   .adn4       reply to a message -> AdditionalNodes (AIRich snip or .json)
 *   .relay4     reply to a message -> relay it live, with its children
 *   .lastchat4  [n] -> last n archived messages in this chat
 *
 * Ported from LUNA MD plugins/crm.js.
 *
 * Name: `crm4` because NexoraFlex already ships `.crm` / `.crm2`
 * (src/plugins/owner/crm.js) and the staged `.crm3` / `.crm3js`
 * (src/plugins/owner/crm3.js). The original's commands (`crm`, `crm2`,
 * `insp`, `adn`, `relay`, `lastchat`) are NOT claimed here.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`, `conn` -> `sock`,
 *     owner gating via `permissions: { owner: true }`.
 *   - NO better-sqlite3 (NexoraFlex has no such dep): the message
 *     archive is the HOUSE store src/lib/crmStore.js (JSONL per chat
 *     under data/crm/, in-memory index) — the same store the house
 *     .crm reads. `initCrmStore()` runs at import and
 *     `bindCrmStore(sock)` on first use, so the archive fills from
 *     everything the socket sees and sends (the house store was
 *     previously never bound). `saveMessage` / `loadMessage` /
 *     `loadNode` / `recentIds` / `decryptSecretEnvelope` all come from
 *     there; the local AIRich class is gone in favour of the house
 *     AIRich from src/lib/NIXCODE.js (same setTitle/setFooter/addText/
 *     addSuggest/addCode/send API).
 *   - No SQL: `#rowid` is now the recency index — `#1` is the most
 *     recent archived message in this chat, `#2` the one before it
 *     (up to the last 100). The child tree is built from
 *     `recentIds(chat, 200)` instead of a timestamp-window query, and
 *     `.lastchat4` lists the latest archived messages (the quoted
 *     message's timestamp is used as an upper bound when given).
 *   - Secret (edited/deleted) messages are decrypted with the house
 *     `decryptSecretEnvelope()` instead of the local HKDF/AES code.
 *   - The quoted message comes from `m.quoted.fakeObj` (the house
 *     shape for a raw WebMessageInfo) with a plain-object fallback,
 *     instead of the LUNA-only `m.getQuotedObj()`.
 *   - Timestamps render in Africa/Accra (was Asia/Jakarta).
 *   - The generated relay snippet text is kept byte-identical to the
 *     original (it still says `m.chat` / `conn`) so saved relay files
 *     keep working with the .runcrm runner.
 */
import crypto from 'crypto';
import { proto, generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';
import { AIRich } from '../../lib/NIXCODE.js';
import { initCrmStore, bindCrmStore, loadMessage, loadNode, recentIds, decryptSecretEnvelope } from '../../lib/crmStore.js';

initCrmStore();

const MODE_BY_COMMAND = {
  crm4: 'crm',
  crm4btn: 'crm2',
  insp4: 'insp',
  adn4: 'adn',
  relay4: 'relay',
  lastchat4: 'lastchat',
};

const TO_OBJECT_OPTS = { enums: Number, longs: Number, bytes: String, defaults: false };

function toPlain(rmsg) {
  return proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(rmsg), TO_OBJECT_OPTS);
}

function quotedInfo(m) {
  if (m.quoted?.fakeObj) return m.quoted.fakeObj;
  const q = m.quoted;
  if (!q) return null;
  return {
    key: q.key || { id: q.id, remoteJid: m.from, participant: q.sender || q.participant, fromMe: false },
    message: q.message || q.msg || null,
    messageTimestamp: q.messageTimestamp || Math.floor(Date.now() / 1000),
  };
}

class Button {
  #client; #title = ''; #body = ''; #media = null; #buttons = [];
  constructor(c) { this.#client = c; }
  setTitle(t) { this.#title = t; return this; }
  setBody(t) { this.#body = t; return this; }
  setMedia(m) { this.#media = m; return this; }
  setParams(p) { return this; }
  addCopy(d, i) { this.#buttons.push({ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: d, copy_code: i || d }) }); return this; }
  async send(jid, opts = {}) {
    let content = {};
    if (this.#media?.document) content = { document: this.#media.document, mimetype: this.#media.mimetype, fileName: this.#media.fileName, caption: `*${this.#title}*\n\n${this.#body}`, footer: this.#title, buttons: this.#buttons, headerType: 1 };
    else content = { text: `*${this.#title}*\n\n${this.#body}`, footer: this.#title, buttons: this.#buttons, headerType: 1 };
    const waMsg = generateWAMessageFromContent(jid, { viewOnceMessage: { message: content } }, { messageId: generateMessageIDV2(), ...opts });
    return this.#client.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
  }
}

export default {
  name: 'crm4',
  aliases: ['crm4btn', 'insp4', 'adn4', 'relay4', 'lastchat4'],
  category: 'owner',
  description: 'Owner-only relay-message inspector. Reply to a message: .crm4 (relay file), .crm4btn (buttons), .insp4 (raw), .adn4 (nodes), .relay4 (re-send), .lastchat4 [n]',
  cooldown: 2000,
  permissions: { owner: true },
  execute: async ({ m, sock, args, prefix, commandName }) => {
    bindCrmStore(sock);
    const cmd = MODE_BY_COMMAND[commandName] || 'crm';
    const text = (args || []).join(' ');
    const argList = String(text || '').trim().split(/\s+/).filter(Boolean);
    const chatId = m.from;
    if (cmd === 'lastchat') {
      const parsed = Number(argList[0] || 10);
      const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), 100);
      const ref = getReferenceMessage(m);
      const rows = getLastChatRows(chatId, limit, ref.timestamp);
      if (!rows.length) return m.reply('No messages found.');
      return m.reply(formatLastChat(rows));
    }
    const rowMatch = argList[0]?.match(/^#(\d+)$/);
    const rowid = rowMatch ? Number(rowMatch[1]) : null;
    let targetId;
    let msgSource;
    let rmsg;
    if (rowid !== null) {
      const ids = recentIds(chatId, 100);
      targetId = ids[rowid - 1];
      if (!targetId) return m.reply(`Message with rowid #${rowid} not found.`);
      const found = loadMessage(targetId, chatId);
      if (!found) return m.reply(`Message with rowid #${rowid} not found.`);
      try { rmsg = toPlain(found); } catch (e) { return m.reply(`Failed to decode rowid #${rowid}:\n${e.message}`); }
      msgSource = `rowid:${rowid}`;
    } else {
      if (!m.quoted) {
        return m.reply(`📌 *.${commandName}* needs a replied message.\n\n•.crm4 → relay file\n•.crm4 -snip → AIRich snippet\n•.crm4btn → buttons\n•.adn4 → AdditionalNodes\n•.insp4 → raw payload\n•.relay4 → relay again\n•.lastchat4 [n] → last n messages`);
      }
      targetId = m.quoted.key?.id || m.quoted.id;
      const sources = [
        { type: 'crmstore', data: targetId ? loadMessage(targetId, chatId) : null },
        { type: 'quotedObj', data: quotedInfo(m) },
        { type: 'fakeObj', data: m.quoted?.fakeObj },
      ];
      const source = sources.find((v) => v.data?.message || v.data?.key);
      msgSource = source?.type;
      rmsg = source?.data;
    }
    let msg;
    if (rmsg) msg = normalizeMessage(rmsg);
    if (!msg?.message) return m.reply('⛓️‍💥 Invalid message');
    const messageId = msg.key?.id || targetId;
    const rawNode = loadBestNode(messageId, chatId, msg);
    const nodeAttrs = getNodeAttributes(rawNode);
    const nodeContent = getNodeContent(rawNode);
    const type = Object.keys(msg.message).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || 'unknown';
    const additionalNodes = filterAdditionalNodes(nodeContent);
    const relayOptions = getRelayOptions(rawNode);
    const parentSender = getSenderIdentity(msg.key);
    const noChild = text.includes('-nochild');
    const noProto = text.includes('-noproto');
    const stats = { fails: 0 };
    const childTree = noChild ? [] : await buildChildTree(chatId, messageId, parentSender, 200, 0, 5, new Set(), !noProto, stats);
    if (cmd === 'relay') {
      const newParentId = await sock.relayMessage(m.from, structuredClone(msg.message), relayOptions);
      await relayChildTree(sock, m.from, childTree, newParentId);
      return m.reply(newParentId);
    }
    const rawPayload = { message: msg, node: rawNode, additionalAttributes: nodeAttrs, additionalNodes };
    const raw = stringify(rawPayload);
    const message = stringify(msg.message);
    const key = stringify(msg.key);
    const options = stringifySnippet(relayOptions);
    const participant = msg.key?.remoteJid || msg.key?.participant || msg.key?.participantAlt || '-';
    const msgId = msg.key?.id || targetId || '-';
    const snippetMessage = stringifySnippet(msg.message);
    const relayCode = buildRelayScript(snippetMessage, stringifySnippet(relayOptions), childTree);
    const files = { raw, message, relay: relayCode };
    const exportType = ['raw', 'message', 'relay'].find((v) => text.includes(`-${v}`));
    if (exportType) {
      if (text.includes('-file')) {
        return sock.sendMessage(m.from, { document: Buffer.from(files[exportType]), fileName: exportType === 'relay' ? `${type}.js` : `${exportType}.json`, mimetype: exportType === 'relay' ? 'application/javascript' : 'application/json' }, { quoted: m });
      }
      return m.reply(files[exportType]);
    }
    const isSnip = text.includes('-snip');
    const formatChat = (chat) => { if (!chat) return '-'; return isSnip ? `${chat.slice(0, 7)}.....${chat.split('@')[1] || ''}` : chat; };
    const formatId = (id) => { if (!id) return '-'; return isSnip ? `${id.slice(0, 7)}.....` : id; };
    const childrenCount = countTree(childTree);
    const childrenLine = stats.fails ? `${childrenCount} (${stats.fails} fail)` : `${childrenCount}`;
    const sender = msg.key?.participant || msg.key?.participantAlt || msg.key?.remoteJid || m.quoted?.sender || '-';
    const nodeChat = rawNode?.attrs?.from || rawNode?.attrs?.to || rawNode?.attrs?.recipient || '-';
    const metadata = `• Type : ${type}\n• Source : ${msgSource || '-'}\n• Chat : ${formatChat(chatId)}\n• Node Chat: ${formatChat(nodeChat)}\n• ID : ${formatId(messageId)}\n• Node ID : ${formatId(rawNode?.attrs?.id || '-')}\n• Sender : ${sender.split('@')[0]}\n• Node Tag : ${rawNode?.tag || '-'}\n• Attrs : ${Object.keys(nodeAttrs).length}\n• Children : ${childrenLine}`;
    if (cmd === 'insp') {
      const inspPayload = attachChildren(rawPayload, childTree);
      const imsg = stringify(inspPayload);
      if (isSnip) {
        if (imsg.length > 20000) { await m.react('❌'); return m.reply('Payload too large for snip.'); }
        return new AIRich(sock).setTitle('📥️ Raw Snippet').setFooter(metadata).addText(`# 📥️ Raw Snippet\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', imsg).send(m.from, { quoted: m });
      }
      return sock.sendMessage(m.from, { document: Buffer.from(imsg), fileName: `${type}.json`, mimetype: 'application/json', caption: metadata }, { quoted: m });
    }
    const adn = text.includes('-nofilter') ? additionalNodes : filterAdditionalNodes(additionalNodes);
    if (cmd === 'adn' && !adn.length) return m.reply('No AdditionalNodes captured 📷');
    if (cmd === 'crm') {
      if (isSnip) {
        if (relayCode.length > 20000) { await m.react('❌'); return m.reply('Payload too large for snip.'); }
        return new AIRich(sock).setTitle('⚡ Relay Snippet').setFooter(metadata).addText(`# ⚡ Relay Snippet\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', relayCode).send(m.from, { quoted: m });
      }
      return sock.sendMessage(m.from, { document: Buffer.from(relayCode), fileName: `${type}.js`, mimetype: 'application/javascript', caption: metadata }, { quoted: m });
    }
    if (cmd === 'adn') {
      if (isSnip) return new AIRich(sock).setTitle('📸 AdditionalNode').setFooter(metadata).addText(`# 📸 AdditionalNode\n${metadata}`).addSuggest([type, chatId, messageId]).addCode('javascript', stringifySnippet(adn)).send(m.from, { quoted: m });
      return sock.sendMessage(m.from, { document: Buffer.from(stringify(adn)), fileName: 'additionalNodes.json', mimetype: 'application/json' }, { quoted: m });
    }
    if (cmd === 'crm2') {
      return new Button(sock).setTitle(capitalize(type)).setBody(metadata + '\n\n' + raw).setMedia({ document: Buffer.from(relayCode), mimetype: 'application/javascript', fileName: `${type}.js` }).addCopy('Copy Full Raw', raw).addCopy('Copy Relay Code', relayCode).send(m.from, { quoted: m });
    }
  },
};

const ignoredTags = new Set(['device-identity', 'quality_control', 'enc', 'hsm', 'verified_name', 'multicast', 'reporting', 'unavailable', 'rcat']);
const ignoredAttributes = new Set(['id', 'from', 'to', 'participant', 'recipient', 'type', 'sts', 'verified_level', 'notify', 'addressing_mode', 'verified_name', 'participant_pn', 't', 'count']);

function loadBestNode(messageId, chatId, msg) {
  if (!messageId) return null;
  let node = null;
  try { node = loadNode(messageId, chatId); } catch {}
  if (node) return node;
  try { const raw = loadNode(messageId); if (raw) return raw; } catch {}
  return null;
}
function getNodeAttributes(node) {
  if (!node?.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs)) return {};
  const attrs = { ...node.attrs };
  for (const key of ignoredAttributes) delete attrs[key];
  return attrs;
}
function getNodeContent(node) {
  if (!node || !Array.isArray(node.content)) return [];
  return node.content;
}
function normalizeMessage(rmsg) {
  const normalized = toPlain(rmsg);
  try { return decryptSecretEnvelope(normalized); } catch { return normalized; }
}
function getSenderIdentity(key) {
  if (!key) return { me: false, jids: new Set() };
  if (key.fromMe) return { me: true, jids: new Set() };
  const jids = new Set([key.participant, key.participantAlt].filter(Boolean));
  if (!jids.size && key.remoteJid) jids.add(key.remoteJid);
  return { me: false, jids };
}
function collectDeepKeys(node, depth = 0, maxDepth = 12, out = []) {
  if (!node || typeof node !== 'object' || depth > maxDepth) return out;
  if (node.protocolMessage?.key) out.push(node.protocolMessage.key);
  if (node.secretEncryptedMessage?.targetMessageKey) out.push(node.secretEncryptedMessage.targetMessageKey);
  for (const value of Object.values(node)) if (value && typeof value === 'object') collectDeepKeys(value, depth + 1, maxDepth, out);
  return out;
}
function getParentKey(key, chat) {
  if (!key?.id) return null;
  return { id: key.id, remoteJid: key.remoteJid || chat, fromMe: !!key.fromMe, participant: key.participant, participantAlt: key.participantAlt };
}
function matchesParentKey(keyObj, parentKey, chat) {
  if (!keyObj || !parentKey) return false;
  if (!keyObj.id || keyObj.id !== parentKey.id) return false;
  const keyRemoteJid = keyObj.remoteJid || keyObj.remoteJidAlt;
  const parentRemoteJid = parentKey.remoteJid || chat;
  if (keyRemoteJid && parentRemoteJid && keyRemoteJid !== parentRemoteJid) return false;
  return true;
}
function findDirectChildren(chat, parentId, parentSender, radius = 200, useProto = true) {
  const base = loadMessage(parentId, chat);
  if (!base) return [];
  let parentMessage;
  try { parentMessage = toPlain(base); } catch { return []; }
  const parentKey = getParentKey(parentMessage.key, chat);
  if (!parentKey) return [];
  const children = [];
  for (const id of recentIds(chat, radius)) {
    if (id === parentId) continue;
    const raw = loadMessage(id, chat);
    if (!raw) continue;
    let decoded;
    try { decoded = toPlain(raw); } catch { continue; }
    const assocKey = decoded?.message?.messageContextInfo?.messageAssociation?.parentMessageKey;
    const matchedAssoc = matchesParentKey(assocKey, parentKey, chat);
    const matchedDeep = useProto ? collectDeepKeys(decoded?.message).some((key) => matchesParentKey(key, parentKey, chat)) : false;
    if (!matchedAssoc && !matchedDeep) continue;
    children.push(decoded);
  }
  return children;
}
async function buildChildTree(chat, parentId, parentSender, radius = 200, depth = 0, maxDepth = 5, visited = new Set(), useProto = true, stats = { fails: 0 }) {
  if (depth >= maxDepth) return [];
  const visitKey = `${chat}:${parentId}:${serializeSender(parentSender)}`;
  if (visited.has(visitKey)) return [];
  visited.add(visitKey);
  const rawChildren = findDirectChildren(chat, parentId, parentSender, radius, useProto);
  const result = [];
  for (const rawChild of rawChildren) {
    const normalized = normalizeMessage(rawChild);
    const decrypted = decryptChildMessage(normalized);
    stats.fails += decrypted.fails;
    const finalRaw = { ...normalized, message: decrypted.message };
    const msg = unwrapAssociatedChild(finalRaw);
    if (!msg?.key?.id || !msg?.message) continue;
    const childId = msg.key.id;
    const childSender = getSenderIdentity(msg.key);
    const childNode = loadBestNode(childId, chat, msg);
    const relayOptions = getRelayOptions(childNode);
    const children = await buildChildTree(chat, childId, childSender, radius, depth + 1, maxDepth, visited, useProto, stats);
    result.push({ raw: finalRaw, node: childNode, msg, relayOptions, children });
  }
  return result;
}
function decryptChildMessage(msgObj) {
  const current = normalizeMessage(msgObj);
  const fails = current?.message?.secretEncryptedMessage ? 1 : 0;
  return { message: current, fails };
}
function serializeSender(sender) {
  if (!sender) return '';
  if (sender.me) return 'me';
  return [...sender.jids].sort().join(',');
}
async function relayChildTree(sock, chat, nodes, parentId) {
  for (const node of nodes) {
    const message = structuredClone(node.msg.message);
    const assoc = message?.messageContextInfo?.messageAssociation;
    if (assoc?.parentMessageKey) {
      assoc.parentMessageKey.id = parentId;
      assoc.parentMessageKey.remoteJid = chat;
      assoc.parentMessageKey.fromMe = true;
    }
    const protocolKeys = collectProtocolKeys(message);
    for (const key of protocolKeys) {
      key.id = parentId;
      key.remoteJid = chat;
      key.fromMe = true;
    }
    const options = { ...node.relayOptions };
    const newChildId = await sock.relayMessage(chat, message, options);
    await relayChildTree(sock, chat, node.children, newChildId);
  }
}
function collectProtocolKeys(node, depth = 0, maxDepth = 12, out = []) {
  if (!node || typeof node !== 'object' || depth > maxDepth) return out;
  if (node.protocolMessage?.key) out.push(node.protocolMessage.key);
  for (const value of Object.values(node)) if (value && typeof value === 'object') collectProtocolKeys(value, depth + 1, maxDepth, out);
  return out;
}
function filterAdditionalNodes(nodes) {
  return (nodes || []).filter((v) => !ignoredTags.has(v?.tag));
}
function getRelayOptions(node = null) {
  const additionalAttributes = getNodeAttributes(node);
  const additionalNodes = filterAdditionalNodes(getNodeContent(node));
  const options = {};
  if (Object.keys(additionalAttributes).length) options.additionalAttributes = additionalAttributes;
  if (additionalNodes.length) options.additionalNodes = additionalNodes;
  return options;
}
function countTree(nodes) {
  return nodes.reduce((sum, node) => sum + 1 + countTree(node.children), 0);
}
function attachChildren(base, tree) {
  if (!tree.length) return base;
  return { ...base, __children: tree.map((node) => { const child = attachChildren(node.raw, node.children); if (node.node) return { ...child, __node: node.node }; return child; }) };
}
function unwrapAssociatedChild(msg) {
  const contextInfo = msg?.message?.messageContextInfo;
  const inner = msg?.message?.associatedChildMessage?.message;
  if (!inner) return msg;
  return { ...msg, message: { ...inner, messageContextInfo: contextInfo } };
}
function findBlockEnd(str, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function injectKeyBlock(snippet, marker, parentIdExpr) {
  const start = snippet.indexOf(marker);
  if (start === -1) return snippet;
  const braceIndex = start + marker.length - 1;
  const end = findBlockEnd(snippet, braceIndex);
  if (end === -1) return snippet;
  const indentMatch = snippet.slice(0, start).match(/([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : '';
  const replacement = `${marker.slice(0, -1)}{\n${indent} remoteJid: m.chat,\n${indent} fromMe: true,\n${indent} id: ${parentIdExpr}\n${indent}}`;
  return snippet.slice(0, start) + replacement + snippet.slice(end + 1);
}
function injectParentKey(childSnippet, parentIdExpr = 'newParentId') { return injectKeyBlock(childSnippet, 'parentMessageKey: {', parentIdExpr); }
function injectTargetKey(childSnippet, parentIdExpr = 'newParentId') { return injectKeyBlock(childSnippet, 'targetMessageKey: {', parentIdExpr); }
function injectProtocolKey(childSnippet, parentIdExpr = 'newParentId') {
  const marker = 'protocolMessage: {';
  const start = childSnippet.indexOf(marker);
  if (start === -1) return childSnippet;
  const braceIndex = start + marker.length - 1;
  const blockEnd = findBlockEnd(childSnippet, braceIndex);
  if (blockEnd === -1) return childSnippet;
  const before = childSnippet.slice(0, start);
  const block = childSnippet.slice(start, blockEnd + 1);
  const after = childSnippet.slice(blockEnd + 1);
  const patchedBlock = injectKeyBlock(block, 'key: {', parentIdExpr);
  return before + patchedBlock + after;
}
function buildChildScript(nodes, parentVar, path = []) {
  const blocks = [];
  nodes.forEach((node, i) => {
    const varName = `id_${[...path, i].join('_')}`;
    const rawChildSnippet = stringifySnippet(node.msg.message);
    let childSnippet = injectParentKey(rawChildSnippet, parentVar);
    childSnippet = injectProtocolKey(childSnippet, parentVar);
    childSnippet = injectTargetKey(childSnippet, parentVar);
    const childOptions = stringifySnippet(node.relayOptions);
    blocks.push(`const ${varName} = await conn.relayMessage(\n m.chat,\n ${indentBlock(childSnippet)},\n ${indentBlock(childOptions)}\n);`);
    if (node.children.length) blocks.push(...buildChildScript(node.children, varName, [...path, i]));
  });
  return blocks;
}
function buildRelayScript(snippetMessage, options, childTree) {
  if (!childTree.length) return `=> conn.relayMessage(\n m.chat,\n ${indentBlock(snippetMessage)},\n ${indentBlock(options)}\n)`;
  const parentBlock = `const newParentId = await conn.relayMessage(\n m.chat,\n ${indentBlock(snippetMessage)},\n ${indentBlock(options)}\n);`;
  const childBlocks = buildChildScript(childTree, 'newParentId');
  return '> ' + [parentBlock, ...childBlocks, 'return newParentId;'].join('\n\n');
}
function getReferenceMessage(m) {
  const chat = m.from;
  const messageId = m.quoted?.key?.id || m.quoted?.id;
  if (messageId) {
    const found = loadMessage(messageId, chat);
    if (found) {
      try {
        const obj = toPlain(found);
        return { chat, timestamp: Number(obj.messageTimestamp) || 0 };
      } catch {}
    }
  }
  return { chat, timestamp: Math.floor(Date.now() / 1000) };
}
function getLastChatRows(chat, limit, beforeTs) {
  const ids = recentIds(chat, limit * 2);
  const rows = [];
  for (let i = 0; i < ids.length && rows.length < limit; i++) {
    const raw = loadMessage(ids[i], chat);
    if (!raw) continue;
    let obj;
    try { obj = toPlain(raw); } catch { continue; }
    const ts = Number(obj.messageTimestamp) || 0;
    if (beforeTs && ts > beforeTs) continue;
    rows.push({ n: i + 1, id: ids[i], chat, sender: obj.key?.participant || obj.key?.remoteJid || null, timestamp: ts, message: obj });
  }
  return rows.reverse();
}
function getMessageType(message) {
  if (!message) return '-';
  return Object.keys(message).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)) || '-';
}
function getPreviewText(message) {
  if (!message) return '-';
  if (typeof message.conversation === 'string') return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage) return message.imageMessage.caption ? `📷 ${message.imageMessage.caption}` : '📷 Image';
  if (message.videoMessage) return message.videoMessage.caption ? `🎥 ${message.videoMessage.caption}` : '🎥 Video';
  if (message.audioMessage) return '🎵 Audio';
  if (message.stickerMessage) return '🎨 Sticker';
  if (message.documentMessage) return message.documentMessage.fileName || '📄 Document';
  if (message.reactionMessage) return `💬 Reaction ${message.reactionMessage.text || ''}`.trim();
  if (message.protocolMessage) {
    const type = message.protocolMessage.type;
    if (type === proto.Message.ProtocolMessage.Type.REVOKE) return '🗑️ Revoke';
    if (type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) return '✏️ Edit';
    return `⚙️ Protocol ${type}`;
  }
  if (message.secretEncryptedMessage) return '🔐 SecretEncryptedMessage';
  return getMessageType(message);
}
function getDisplaySender(message, row) {
  const key = message?.key || {};
  if (key.fromMe) return 'Me';
  return key.participantAlt || key.participant || row?.sender || key.remoteJid || 'Unknown';
}
function formatTimestamp(timestamp) {
  if (!timestamp) return '--:--:--';
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Africa/Accra' }).format(date);
}
function formatLastChat(rows) {
  const lines = [`╭─〔 LAST CHAT • ${rows.length} MESSAGES 〕`, '│'];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const message = row.message;
    const type = getMessageType(message?.message);
    const sender = getDisplaySender(message, row);
    const preview = getPreviewText(message?.message);
    lines.push(`│ ${String(i + 1).padStart(2, '0')} ${formatTimestamp(row.timestamp)} ${sender}`);
    lines.push(`│ ${type} • #${row.n}`);
    lines.push(`│ ${String(preview).replace(/\n/g, ' ').slice(0, 180)}`);
    if (i !== rows.length - 1) lines.push('│');
  }
  lines.push('│');
  lines.push(`╰─ ${rows[0]?.chat || '-'}`);
  return lines.join('\n');
}
function stringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data).toString('base64');
    return value;
  }, 2);
}
function indentBlock(str, level = 1) {
  const pad = ' '.repeat(level);
  return str.split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n');
}
function stringifySnippet(obj) {
  const raws = [];
  const json = JSON.stringify(obj, (key, value) => {
    if (key === 'unifiedResponse' && value && typeof value === 'object' && typeof value.data === 'string') {
      try {
        const decoded = Buffer.from(value.data, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        const id = raws.length;
        raws.push(`Buffer.from(JSON.stringify(${JSON.stringify(parsed, null, 2)})).toString('base64')`);
        return { data: `__RAW_${id}__` };
      } catch {}
    }
    if (key === 'buttonParamsJson' && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        const id = raws.length;
        raws.push(`JSON.stringify(${JSON.stringify(parsed, null, 2)})`);
        return `__RAW_${id}__`;
      } catch {}
    }
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data).toString('base64');
    return value;
  }, 2);
  let code = json.replace(/^(\s*)"([^"]+)":/gm, (_, indent, key) => `${indent}${key}:`);
  code = code.split('\n').map((line) => {
    const match = line.match(/^(\s*).*"__RAW_(\d+)__"/);
    if (!match) return line;
    const [, indent, id] = match;
    const block = raws[Number(id)].split('\n').map((l, i) => (i === 0 ? l : indent + l)).join('\n');
    return line.replace(`"__RAW_${id}__"`, block);
  }).join('\n');
  return code;
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
