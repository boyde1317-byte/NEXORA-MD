/**
 * ocrm3.js — .ocrm3 (reply to a message) — owner message inspector.
 *
 * Ported from the LUNA MD ocrm plugin (luna-md/plugins/ocrm.js),
 * simplified the same way the original was: it exports the replied
 * message as a ready-to-use relay file, raw JSON, or message-only JSON,
 * and can re-send it. Differences from the LUNA original:
 *
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; the quoted message is
 *     rebuilt from m.quoted the way the house src/plugins/owner/crm.js
 *     does it (m.quoted.message / m.quoted.fakeObj), instead of the
 *     LUNA-only m.getQuotedObj() helper.
 *   - The unused `proto` import from 'baileys' is dropped.
 *   - "by luna" / "_by_alya" file names -> "by NEXORA MD" / "_by_nexora".
 *   - No aliases: the house .crm command already owns ocrm, ocrm2,
 *     oinsp, oadn, orelay and olastchat as aliases, so this plugin
 *     answers only to .ocrm3. Its usage text points at the house .crm
 *     for the inspect / additional-nodes / relay variants, and the
 *     lastchat lookup lives there too (the LUNA stub only said the
 *     crmstore SQLite was needed).
 *   - Owner-only via permissions: { owner: true }.
 *
 * Flags: -raw (full payload JSON), -message (message only),
 * -relay (relay code), -file (send as document), -snip (code snippet).
 */
export default {
  name: 'ocrm3',
  aliases: [],
  category: 'owner',
  description: 'Inspect a replied message and export it as relay code or raw JSON (owner only).',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, sock, args, prefix, command }) => {
    const text = args.join(' ');
    const cmd = command || 'ocrm3';
    const p = prefix || '.';

    if ((args[0] || '').toLowerCase() === 'lastchat') {
      return m.reply('The lastchat lookup lives on the house command — use .crm lastchat.');
    }

    if (!m.quoted) {
      const usage = `📌 *.${cmd}* needs a replied message\n\n` +
        `*Owner Commands (NEXORA MD):*\n` +
        `• .${cmd} → Generate a ready-to-use relay file\n` +
        `• .crm insp → Get raw payload JSON\n` +
        `• .crm adn → Get AdditionalNodes\n` +
        `• .crm relay → Relay the message again directly\n\n` +
        `*Flags:*\n` +
        `• -raw → Export raw JSON\n` +
        `• -message → Export message only\n` +
        `• -relay → Export relay code\n` +
        `• -file → Send as a document\n` +
        `• -snip → Show as a snippet\n\n` +
        `Examples:\n` +
        `.${cmd}\n` +
        `.${cmd} -snip\n` +
        `.${cmd} -raw -file`;
      return m.reply(usage);
    }

    const targetId = m.quoted?.key?.id || m.quoted?.id;
    const directPayload = m.quoted?.message || m.quoted?.msg;
    const msg = directPayload
      ? {
          key: {
            ...(m.quoted?.key || {}),
            id: targetId,
            remoteJid: m.quoted?.key?.remoteJid || m.from,
          },
          message: directPayload,
        }
      : m.quoted?.fakeObj || {
          key: {
            ...(m.quoted?.key || {}),
            id: targetId,
            remoteJid: m.quoted?.key?.remoteJid || m.from,
          },
          message: m.quoted?.message || m.quoted?.msg || { conversation: m.quoted?.text || '' },
        };

    if (!msg?.message) return m.reply('⛓️‍💥 Invalid message');

    const type = Object.keys(msg.message).find(
      (v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v)
    ) || 'unknown';

    const additionalAttributes = {};
    const additionalNodes = [];
    const rawPayload = { message: msg, additionalAttributes, additionalNodes };
    const raw = stringify(rawPayload);
    const messageOnly = stringify(msg.message);
    const snippetMessage = stringifySnippet(msg.message);
    const relayCode = `// by NEXORA MD - ${type}\nawait sock.relayMessage(\n m.from,\n ${indentBlock(snippetMessage)},\n {}\n)`;

    const files = { raw, message: messageOnly, relay: relayCode };
    const exportType = ['raw', 'message', 'relay'].find((v) => text.includes(`-${v}`));

    if (exportType) {
      if (text.includes('-file')) {
        return sock.sendMessage(m.from, {
          document: Buffer.from(files[exportType]),
          fileName: exportType === 'relay' ? `${type}_by_nexora.js` : `${exportType}.json`,
          mimetype: exportType === 'relay' ? 'application/javascript' : 'application/json',
        }, { quoted: m });
      }
      return m.reply(files[exportType]);
    }

    const isSnip = text.includes('-snip');
    const metadata = `• Type: ${type}\n• ID: ${msg.key?.id || '-'}\n• Chat: ${msg.key?.remoteJid || m.from}\n• by NEXORA MD`;

    if (isSnip) {
      return m.reply(`\`\`\`javascript\n${relayCode}\n\`\`\`\n\n${metadata}`);
    }

    return sock.sendMessage(m.from, {
      document: Buffer.from(relayCode),
      fileName: `${type}_by_nexora.js`,
      mimetype: 'application/javascript',
      caption: metadata,
    }, { quoted: m });
  },
};

function stringify(obj) {
  return JSON.stringify(obj, (k, v) => {
    if (Buffer.isBuffer(v)) return v.toString('base64');
    if (v?.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data).toString('base64');
    return v;
  }, 2);
}

function stringifySnippet(obj) {
  const json = JSON.stringify(obj, (k, v) => {
    if (Buffer.isBuffer(v)) return v.toString('base64');
    if (v?.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data).toString('base64');
    return v;
  }, 2);
  return json.replace(/^(\s*)"([^"]+)":/gm, (_, indent, key) => `${indent}${key}:`);
}

function indentBlock(str, level = 1) {
  const pad = ' '.repeat(level);
  return str.split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n');
}
