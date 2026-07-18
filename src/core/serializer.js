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
    // ── New message types added by boyde1317-byte/baileys fork ─────────────
    case 'stickerPackMessage':
      // Pack name is the closest thing to a body for sticker packs
      return msgContent.title || msgContent.name || '';
    case 'lottieStickerMessage':
      // Animated sticker — no text body
      return '';
    case 'pollResultSnapshotMessage':
      // Poll result — expose the question text if present
      return msgContent.name || '';
    case 'groupStatusMessageV2':
    case 'spoilerMessage':
      // Wrapper types — unwrap and extract from inner message
      if (msgContent.message) {
        const innerType = Object.keys(msgContent.message)[0] || '';
        return extractBody(innerType, msgContent.message[innerType]);
      }
      return '';
    default:
      return '';
  }
}

/**
 * Safely normalise a raw JID that might have a device suffix (:14) or be undefined.
 * Preserves the original domain (e.g. @s.whatsapp.net, @lid, @g.us).
 */
function normaliseJid(raw) {
  if (!raw) return '';
  if (!raw.includes(':')) return raw;
  // Strip the device suffix (e.g. "number:14@s.whatsapp.net" → "number@s.whatsapp.net")
  // but keep whatever domain was originally present.
  const atIdx = raw.lastIndexOf('@');
  const domain = atIdx !== -1 ? raw.slice(atIdx) : '@s.whatsapp.net';
  const user   = (atIdx !== -1 ? raw.slice(0, atIdx) : raw).split(':')[0];
  return user + domain;
}

/**
 * Resolve a JID to its phone-number JID form, following LID → PN mappings when
 * the given JID is an opaque LID.
 *
 * WHY: `sock.contacts` is never populated in this codebase (no in-memory store
 * is attached, no `contacts.upsert`/`contacts.update` listener), so any LID
 * resolution that depended on it silently failed 100% of the time. The Baileys
 * fork ships a real LID↔PN bridge on the socket itself — `sock.signalRepository
 * .lidMapping` — which is populated from the encrypted session data regardless
 * of whether a contact store exists. That is the correct source of truth.
 *
 * @param {object} sock  Baileys socket (needs `signalRepository.lidMapping`)
 * @param {string} jid   JID or LID to resolve
 */
async function resolvePhoneJid(sock, jid) {
  const norm = normaliseJid(jid);
  if (!norm || !norm.endsWith('@lid')) return norm;
  try {
    const pn = await sock?.signalRepository?.lidMapping?.getPNForLID(norm);
    const pnJid = typeof pn === 'string' ? pn : (pn?.pn || pn?.jid || pn?.id || '');
    if (pnJid) return normaliseJid(pnJid);
  } catch (_) {
    // lidMapping lookup can throw if the session has no record yet — fall through.
  }
  return norm;
}

/**
 * Resolve a JID to its opaque-LID form, following PN → LID mappings when the
 * given JID is a phone-number JID. Mirror of {@link resolvePhoneJid}.
 */
async function resolveLidJid(sock, jid) {
  const norm = normaliseJid(jid);
  if (!norm || !norm.endsWith('@s.whatsapp.net')) return norm;
  try {
    const lid = await sock?.signalRepository?.lidMapping?.getLIDForPN(norm);
    const lidJid = typeof lid === 'string' ? lid : (lid?.lid || lid?.jid || lid?.id || '');
    if (lidJid) return normaliseJid(lidJid);
  } catch (_) {
    // No mapping stored yet — fall through.
  }
  return norm;
}

/**
 * Find a participant in the group metadata by JID, handling LID ↔ phone-JID mismatches.
 *
 * Modern WhatsApp may identify the same user differently in message keys vs group
 * participant lists — one side uses a phone JID (number@s.whatsapp.net) and the
 * other uses an opaque LID (opaqueid@lid). A plain === comparison always fails in
 * that situation, so we resolve through Baileys' real LID↔PN bridge
 * (`sock.signalRepository.lidMapping`) in both directions, falling back to
 * `sock.contacts` only as a last resort for older/base Baileys builds that may
 * populate it.
 *
 * @param {Array}  participants  meta.participants array
 * @param {string} targetJid     JID or LID to look up
 * @param {object} sock          Baileys socket
 */
async function findParticipant(participants, targetJid, sock) {
  const norm = normaliseJid(targetJid);

  // 1. Direct normalised match (fast path — works when both sides use the same format)
  const direct = participants.find(p => normaliseJid(p.id) === norm);
  if (direct) return direct;

  const contacts = sock?.contacts || {};

  // 2. LID → phone JID (authoritative: signalRepository; fallback: contacts store)
  if (norm.endsWith('@lid')) {
    const viaRepo = await resolvePhoneJid(sock, norm);
    if (viaRepo !== norm) {
      const byRepo = participants.find(p => normaliseJid(p.id) === viaRepo);
      if (byRepo) return byRepo;
    }
    const contact = Object.values(contacts).find(
      c => normaliseJid(c.lid || '') === norm || normaliseJid(c.id || '') === norm
    );
    if (contact) {
      const phoneJid = normaliseJid(contact.jid || contact.id || '');
      if (phoneJid && phoneJid !== norm) {
        const byPhone = participants.find(p => normaliseJid(p.id) === phoneJid);
        if (byPhone) return byPhone;
      }
    }
  }

  // 3. Phone JID → LID (authoritative: signalRepository; fallback: contacts store)
  if (norm.endsWith('@s.whatsapp.net')) {
    const viaRepo = await resolveLidJid(sock, norm);
    if (viaRepo !== norm) {
      const byRepo = participants.find(p => normaliseJid(p.id) === viaRepo);
      if (byRepo) return byRepo;
    }
    const contact = contacts[norm];
    if (contact?.lid) {
      const lidNorm = normaliseJid(contact.lid);
      const byLid = participants.find(p => normaliseJid(p.id) === lidNorm);
      if (byLid) return byLid;
    }
  }

  return null;
}

/**
 * Resolve whether a sender JID belongs to the configured bot owner(s),
 * following LID → phone-number resolution so owner checks keep working when
 * WhatsApp presents the owner's own account as an opaque LID instead of a
 * phone-number JID (common with privacy settings on newer accounts).
 */
async function resolveIsOwner(sock, senderJid, fromMe) {
  const botNumber = sock?.user?.id?.split('@')[0]?.split(':')[0];
  const botIsOwner = !!(botNumber && config.owner.includes(botNumber));
  if (fromMe && botIsOwner) return true;

  const rawNumber = normaliseJid(senderJid).split('@')[0];
  if (config.owner.includes(rawNumber)) return true;

  // Sender presented as a LID — resolve to the real phone number before giving up.
  const pnJid = await resolvePhoneJid(sock, senderJid);
  const pnNumber = pnJid.split('@')[0];
  return config.owner.includes(pnNumber);
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
    // LID fix: WhatsApp may present the sender as an opaque LID instead of a phone number
    // (privacy setting on newer accounts). resolveIsOwner follows the real LID↔PN bridge
    // (sock.signalRepository.lidMapping) rather than comparing the opaque LID directly.
    message.isOwner  = await resolveIsOwner(sock, message.sender, message.fromMe);
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
        isOwner:      await resolveIsOwner(sock, quotedSender, quotedSender === normaliseJid(sock.user?.id)),
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
    const p = await findParticipant(meta.participants, message.sender, sock);
    return !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
  };

  message.isBotAdmin = async () => {
    if (!message.isGroup) return false;
    const meta = await message.getGroupMetadata();
    if (!meta) return false;
    const botJid = normaliseJid(sock.user?.id);
    const p = await findParticipant(meta.participants, botJid, sock);
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
