/**
 * adminAlert — promote / demote announcements as group-invite cards.
 *
 * The alert text is sent with a synthetic `groupInviteMessage` as its quoted
 * context, so the bubble arrives as a group card (group name + thumbnail +
 * caption) with the alert underneath, instead of a plain text line. The quote
 * is the same fake-quote trick the enrich command uses, so no real invite is
 * created and no invite code is exposed (`inviteCode: 'null'`, cosmetic).
 */
import sharp from 'sharp';
import { buildFakeGroupInviteQuote } from '../lib/waUtils.js';
import { imageManager } from '../images/imageManager.js';

/** Thumbnails ride inside the stanza — keep them small (WhatsApp's own are ~3-15 KB). */
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 68;

const toThumb = async (input) => {
  try {
    return await sharp(input)
      .resize(THUMB_WIDTH, THUMB_WIDTH, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: THUMB_QUALITY })
      .toBuffer();
  } catch {
    return null;
  }
};

/**
 * The card image: the group's own icon when it has one, otherwise the brand
 * menu banner so the card never arrives blank.
 *
 * @param {object} sock
 * @param {string} jid
 * @returns {Promise<Buffer|null>}
 */
export async function resolveGroupThumbnail(sock, jid) {
  try {
    const iconUrl = await sock.profilePictureUrl(jid, 'image');
    if (iconUrl) {
      const res = await fetch(iconUrl);
      if (res.ok) {
        const thumb = await toThumb(Buffer.from(await res.arrayBuffer()));
        if (thumb) return thumb;
      }
    }
  } catch { /* no group icon, private, or fetch failed — fall through */ }

  try {
    const img = await imageManager.getMenuImage(5);
    if (img?.buffer) return await toThumb(img.buffer);
    if (img?.source?.startsWith?.('http')) {
      const res = await fetch(img.source);
      if (res.ok) return await toThumb(Buffer.from(await res.arrayBuffer()));
    }
  } catch { /* no banner — card renders without a picture */ }

  return null;
}

/**
 * The quoted context for an admin alert.
 *
 * @param {object} input
 * @param {string} input.groupJid
 * @param {string} input.groupName
 * @param {boolean} input.isPromotion
 * @param {Buffer|null} [input.thumbnail]
 * @returns {object} fake quoted message for `{ quoted: … }`
 */
export function buildAdminQuote({ groupJid, groupName, isPromotion, thumbnail = null } = {}) {
  return buildFakeGroupInviteQuote({
    groupJid,
    inviteCode: 'null',
    groupName: groupName || 'this group',
    caption: isPromotion ? '🎖️ New group admin' : '📉 Admin removed',
    jpegThumbnail: thumbnail || undefined,
  });
}

/**
 * Send one admin alert.
 *
 * @param {object} sock
 * @param {string} jid
 * @param {object} input
 * @param {string} input.text            alert body (already mentions the user)
 * @param {string} input.resolvedJid     JID to mention
 * @param {string} input.groupName
 * @param {boolean} input.isPromotion
 */
export async function sendAdminAlert(sock, jid, { text, resolvedJid, groupName, isPromotion } = {}) {
  const thumbnail = await resolveGroupThumbnail(sock, jid);
  const quote = buildAdminQuote({ groupJid: jid, groupName, isPromotion, thumbnail });

  return sock.sendMessage(
    jid,
    { text, mentions: resolvedJid ? [resolvedJid] : [] },
    { quoted: quote }
  );
}

export default sendAdminAlert;
