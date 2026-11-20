/**
 * crm.js — reply to any message and get its payload back.
 *
 *   .crm        relay script for the replied message (a ready-to-run .js file)
 *   .crm2       the same script inline as a code card
 *   .insp       the raw payload as JSON (stanza tree attached when archived)
 *   .adn        just the additionalNodes that make a card render
 *   .lastchat   the last ids archived for this chat
 *   .crmstats   how much the archive holds
 *
 * Owner-only: this exposes raw protos, other people's messages, and recovered
 * edits. The archive itself lives in src/lib/crmStore.js.
 */
import { generateMessageIDV2, proto } from 'baileys';
import { loadMessage, loadNode, recentIds, crmStats, decryptSecretEnvelope } from '../../lib/crmStore.js';
import { RichSections } from '../../lib/richSections.js';

/** Peel the wrappers WhatsApp puts around real content. */
function unwrap(content) {
  let node = content;
  for (let i = 0; i < 6 && node && typeof node === 'object'; i += 1) {
    const inner = node.ephemeralMessage?.message
      || node.viewOnceMessage?.message
      || node.viewOnceMessageV2?.message
      || node.viewOnceMessageV2Extension?.message
      || node.documentWithCaptionMessage?.message;
    if (!inner) break;
    node = inner;
  }
  return node;
}

/** `conversation` is legacy; relay wants extendedTextMessage. */
function normalizeForRelay(content) {
  const node = unwrap(content);
  if (typeof node?.conversation === 'string') {
    const { conversation, ...rest } = node;
    return { ...rest, extendedTextMessage: { text: conversation } };
  }
  return node;
}

/** Buffers cannot survive JSON.stringify — turn them into a literal we can paste. */
function toJsLiteral(value, indent = 2, depth = 0) {
  const pad = ' '.repeat(indent * depth);
  const padIn = ' '.repeat(indent * (depth + 1));
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return `Buffer.from("${value.toString('base64')}", "base64")`;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const items = value.map((v) => toJsLiteral(v, indent, depth + 1));
    if (items.join(', ').length < 72) return `[${items.join(', ')}]`;
    return `[\n${items.map((i) => padIn + i).join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    const parts = keys.map((k) => `${JSON.stringify(k)}: ${toJsLiteral(value[k], indent, depth + 1)}`);
    if (parts.join(', ').length < 72) return `{ ${parts.join(', ')} }`;
    return `{\n${parts.map((p) => padIn + p).join(',\n')}\n${pad}}`;
  }
  return 'null';
}

const buildRelayScript = (message, additionalNodes = []) => `// NEXORA relay snippet — paste into a plugin and run with your socket.
// Regenerate from the bot with .crm after replying to the message.
const relay = async (sock, jid) => {
  await sock.relayMessage(jid, ${toJsLiteral(message, 2)}, {
${additionalNodes?.length ? `    additionalNodes: ${toJsLiteral(additionalNodes, 2)},` : ''}
  });
};

export default relay;
`;

/** Pull the biz/native-flow nodes out of an archived stanza tree. */
function collectBizNodes(node, depth = 0, out = []) {
  if (!node || typeof node !== 'object' || depth > 8) return out;
  if (node.tag === 'biz') out.push(node);
  for (const child of node.content || []) collectBizNodes(child, depth + 1, out);
  return out;
}

export default {
  name: 'crm',
  aliases: [
    'crm2', 'insp', 'adn', 'relay', 'lastchat', 'crmstats',
    'ocrm', 'ocrm2', 'oinsp', 'oadn', 'orelay', 'olastchat',
  ],
  category: 'owner',
  description: 'Inspect the replied message: .crm (relay script), .insp (raw), .adn (nodes), .crm2 (inline), .lastchat, .crmstats',
  permissions: { owner: true },
  cooldown: 1500,

  execute: async ({ sock, m, args, command }) => {
    const jid = m.from;
    const rawCmd = String(command || 'crm').toLowerCase();
    const cmd = ({
      ocrm: 'crm',
      ocrm2: 'crm2',
      oinsp: 'insp',
      oadn: 'adn',
      orelay: 'relay',
      olastchat: 'lastchat',
    })[rawCmd] || rawCmd;

    if (cmd === 'crmstats') {
      const stats = crmStats();
      return m.reply(`*CRM archive*\n\nmessages: ${stats.messages}\nnodes: ${stats.nodes}\ndir: ${stats.dir}`);
    }

    if (cmd === 'lastchat') {
      const limit = Math.min(Number(args[0]) || 10, 40);
      const ids = recentIds(jid, limit);
      if (!ids.length) return m.reply('Nothing archived for this chat yet.');
      return m.reply(`*Last ${ids.length} archived*\n\n${ids.map((id, i) => `${i + 1}. ${id}`).join('\n')}\n\nReply to any message and send .crm to dump it.`);
    }

    const targetId = m.quoted?.key?.id || m.quoted?.id;
    if (!targetId) {
      return m.reply('Reply to a message first, then send .crm / .insp / .adn.');
    }

    // Rem reads the quoted message directly. The archive is optional
    // enrichment for recovered edits and stanza nodes, never a prerequisite.
    const directQuoted = m.quoted?.fakeObj || {
      key: {
        ...(m.quoted?.key || {}),
        id: targetId,
        remoteJid: m.quoted?.key?.remoteJid || jid,
      },
      message: m.quoted?.message || m.quoted?.msg || { conversation: m.quoted?.text || '' },
    };
    let archived = loadMessage(targetId, jid);
    if (!archived) archived = loadMessage(targetId);
    const sourceMessage = archived || directQuoted;
    const sourceKind = archived ? 'archive' : 'live quoted message';
    const asObject = proto.WebMessageInfo.toObject(proto.WebMessageInfo.fromObject(sourceMessage), {
      enums: Number, longs: Number, bytes: String, defaults: false,
    });
    const recovered = decryptSecretEnvelope(asObject);
    const rawNode = archived ? (loadNode(targetId, jid) || loadNode(targetId)) : null;
    const bizNodes = collectBizNodes(rawNode);
    const message = normalizeForRelay(recovered.message);
    const meta = [
      `id: ${targetId}`,
      `chat: ${jid}`,
      `source: ${sourceKind}`,
      `from: ${(asObject.key?.participant || asObject.key?.remoteJid || '-').split('@')[0]}`,
      `type: ${Object.keys(message || {})[0] || '-'}`,
      rawNode ? `node: ${rawNode.tag || '-'} (${(rawNode.content || []).length} children)` : 'node: not available from live quote',
      bizNodes.length ? `biz nodes: ${bizNodes.length}` : 'biz nodes: none',
      recovered.__decryptedFrom ? `recovered: decrypted ${recovered.__decryptedFrom}` : null,
    ].filter(Boolean).join('\n');

    if (rawCmd === 'orelay') {
      await sock.relayMessage(jid, message, { messageId: generateMessageIDV2() });
      return m.reply(`Relayed ${targetId} directly.\nPayload type: ${Object.keys(message || {})[0] || 'unknown'}`);
    }

    if (cmd === 'insp') {
      const payload = JSON.stringify({ message, node: rawNode || null }, null, 2);
      return sock.sendMessage(jid, {
        document: Buffer.from(payload),
        fileName: `${targetId}.json`,
        mimetype: 'application/json',
        caption: meta,
      }, { quoted: m });
    }

    if (cmd === 'adn') {
      if (!bizNodes.length) return m.reply(`No additionalNodes archived for ${targetId}.\n\n${meta}`);
      return sock.sendMessage(jid, {
        document: Buffer.from(JSON.stringify(bizNodes, null, 2)),
        fileName: `${targetId}-nodes.json`,
        mimetype: 'application/json',
        caption: meta,
      }, { quoted: m });
    }

    const script = buildRelayScript(message, bizNodes);

    if (cmd === 'crm2') {
      const card = new RichSections(sock)
        .setTitle('⚡ Relay snippet')
        .addText(`# ⚡ Relay snippet\n${meta}`)
        .addCode(script, { language: 'javascript', id: 'code' })
        .setFooter(`${targetId.slice(0, 12)}…`);
      return card.send(jid);
    }

    return sock.sendMessage(jid, {
      document: Buffer.from(script),
      fileName: `${targetId}.js`,
      mimetype: 'application/javascript',
      caption: meta,
    }, { quoted: m });
  },
};
