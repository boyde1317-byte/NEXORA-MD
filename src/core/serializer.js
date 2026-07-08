import { downloadMediaMessage } from 'baileys';
import { config } from '../../config/index.js';
import { messageFormatter } from '../ui/messageFormatter.js';

/**
 * Extracts the body text from a raw message content object.
 */
function extractBody(type, msgContent) {
  if (!msgContent) return '';

  switch (type) {
    case 'conversation':
      return typeof msgContent === 'string' ? msgContent : (msgContent || '');
    case 'extendedTextMessage':
      return msgContent.text || '';
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
      return msgContent.caption || '';
    case 'documentWithCaptionMessage':
      return msgContent.message?.documentMessage?.caption || '';
    case 'buttonsResponseMessage':
      return msgContent.selectedButtonId || '';
    case 'listResponseMessage':
      return msgContent.singleSelectReply?.selectedRowId || '';
    case 'templateButtonReplyMessage':
      return msgContent.selectedId || '';
    case 'interactiveResponseMessage': {
      try {
        const parsed = JSON.parse(msgContent.nativeFlowResponseMessage?.paramsJson || '{}');
        return parsed.id || '';
      } catch {
        return '';
      }
    }
    case 'ephemeralMessage':
      // Unwrap disappearing message envelope
      return extractBody(
        Object.keys(msgContent.message || {})[0] || '',
        Object.values(msgContent.message || {})[0]
      );
    case 'viewOnceMessage':
    case 'viewOnceMessageV2': {
      // Unwrap view-once envelope — body is usually empty for commands but expose it
      const inner = msgContent.message || {};
      const innerType = Object.keys(inner)[0] || '';
      return extractBody(innerType, inner[innerType]);
    }
    default:
      return '';
  }
}

/**
 * Safely normalise a raw JID that might have a device suffix (:14) or be undefined.
 */
function normaliseJid(raw) {
  if (!raw) return '';
  return raw.includes(':') ? raw.split(':')[0] + '@s.whatsapp.net' : raw;
}

export async function serialize(m, sock) {
  if (!m) return m;

  const message = { ...m };

  if (message.key) {
    message.id       = message.key.id;
    message.from     = message.key.remoteJid;
    message.fromMe   = message.key.fromMe;
    message.isGroup  = message.from?.endsWith('@g.us') ?? false;

    const rawSender  = message.key.participant || message.key.remoteJid;
    message.sender   = normaliseJid(rawSender);
    message.senderNumber = message.sender.split('@')[0];
    message.isOwner  = config.owner.includes(message.senderNumber);
  }

  if (message.message) {
    const types = Object.keys(message.message);

    // Skip pure protocol / key-distribution messages
    const type = types.find(t =>
      t !== 'messageContextInfo' &&
      t !== 'senderKeyDistributionMessage' &&
      t !== 'protocolMessage'
    ) || types[0];

    message.type    = type;
    const msgContent = message.message[type];
    message.msg     = msgContent;

    // Extract body text — safe for every known message shape
    message.body = extractBody(type, msgContent);

    // ── Quoted message parsing ──────────────────────────────────────────────
    const contextInfo = msgContent?.contextInfo;
    if (contextInfo?.quotedMessage) {
      const qMessage = contextInfo.quotedMessage;
      const qTypes   = Object.keys(qMessage);
      const qType    = qTypes.find(t => t !== 'messageContextInfo') || qTypes[0];
      const qContent = qMessage[qType];

      // Guard: participant can be absent in DMs or self-quoting — never crash
      const rawQuotedSender = contextInfo.participant || message.key.remoteJid || '';
      const quotedSender    = normaliseJid(rawQuotedSender);

      message.quoted = {
        id:           contextInfo.stanzaId,
        sender:       quotedSender,
        senderNumber: quotedSender.split('@')[0],
        isOwner:      config.owner.includes(quotedSender.split('@')[0]),
        type:         qType,
        message:      qMessage,
        msg:          qContent,
        body:         extractBody(qType, qContent),
        download: async () => {
          const fakeMessage = {
            key: {
              remoteJid:   message.from,
              fromMe:      quotedSender === normaliseJid(sock.user?.id),
              id:          contextInfo.stanzaId,
              participant: contextInfo.participant
            },
            message: qMessage
          };
          return await downloadMediaMessage(fakeMessage, 'buffer', {});
        }
      };
    }
  }

  // ── Group helpers ──────────────────────────────────────────────────────────
  message.getGroupMetadata = async () => {
    if (!message.isGroup) return null;
    try {
      return await sock.groupMetadata(message.from);
    } catch (e) {
      console.error(`[SERIALIZER] Failed to fetch group metadata for ${message.from}:`, e.message);
      return null;
    }
  };

  message.isAdmin = async () => {
    if (!message.isGroup) return false;
    const meta = await message.getGroupMetadata();
    if (!meta) return false;
    const p = meta.participants.find(p => normaliseJid(p.id) === message.sender);
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
  };

  message.isBotAdmin = async () => {
    if (!message.isGroup) return false;
    const meta = await message.getGroupMetadata();
    if (!meta) return false;
    const botJid = normaliseJid(sock.user?.id);
    const p = meta.participants.find(p => normaliseJid(p.id) === botJid);
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
  };

  // ── Reply helper ──────────────────────────────────────────────────────────
  const replyFn = async (text, options = {}) => {
    return await sock.sendMessage(message.from, { text }, { quoted: m, ...options });
  };

  replyFn.success = async (text, options = {}) =>
    replyFn(messageFormatter.success(text), options);
  replyFn.error   = async (text, options = {}) =>
    replyFn(messageFormatter.error(text), options);
  replyFn.warn    = async (text, options = {}) =>
    replyFn(messageFormatter.warn(text), options);
  replyFn.info    = async (text, title = 'INFO', options = {}) =>
    replyFn(messageFormatter.info(text, title), options);
  replyFn.loading = async (text = 'Processing...', options = {}) =>
    replyFn(messageFormatter.loading(text), options);

  message.reply = replyFn;

  // ── React helper ──────────────────────────────────────────────────────────
  message.react = async (emoji) => {
    return await sock.sendMessage(message.from, {
      react: { text: emoji, key: message.key }
    });
  };

  // ── Edit helper ───────────────────────────────────────────────────────────
  message.edit = async (newText) => {
    return await sock.sendMessage(message.from, {
      text: newText,
      edit: message.key
    });
  };

  // ── Delete helper ─────────────────────────────────────────────────────────
  message.delete = async () => {
    return await sock.sendMessage(message.from, { delete: message.key });
  };

  // ── Media download helper ─────────────────────────────────────────────────
  message.download = async () => {
    if (!message.message) return null;
    return await downloadMediaMessage(m, 'buffer', {});
  };

  return message;
}

export default serialize;
