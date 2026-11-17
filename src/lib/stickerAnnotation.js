import sharp from 'sharp';
import { generateWAMessageContent, generateWAMessageFromContent } from 'baileys';

/**
 * Sticker annotation — a sticker attached to an existing message.
 *
 * `ReactImg` from the zapo samples calls this a "reaction sticker", but the
 * proto it uses says something else: `messageContextInfo.messageAssociation`
 * with `associationType: 11`, and 11 is `STICKER_ANNOTATION` in WAProto
 * (STATUS_REACTION is 18, and a real reaction is `reactionMessage`, with no
 * association involved at all).
 *
 * What it does in practice: the sticker is tied to a parent message key, so a
 * client that advertises message-association support paints the sticker ON the
 * parent message instead of as a loose new message in the chat. Clients without
 * that support render a normal sticker, so it degrades rather than fails.
 *
 * The parent must be a real message key — usually the command message you are
 * answering. A synthetic key points at nothing, which is how the sample's
 * `parentMessageKey` misuse shows up in the wild.
 */

/** Association type enum value for STICKER_ANNOTATION in WAProto. */
export const STICKER_ANNOTATION = 11;

/**
 * Turn image bytes into sticker bytes. WhatsApp still stickers are 512x512 WebP.
 *
 * @param {Buffer|Uint8Array} input
 * @returns {Promise<Buffer>}
 */
export async function toStickerWebp(input) {
  if (!input || !input.length) throw new TypeError('Sticker source image is required');
  return await sharp(Buffer.from(input))
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Pure payload builder — kept separate so the shape can be asserted offline.
 *
 * @param {object} opts
 * @param {object} opts.stickerMessage  Uploaded sticker proto (url, mediaKey, …)
 * @param {object} opts.parentKey       Message key of the message being annotated
 * @param {number} [opts.associationType]
 */
export function buildAnnotationMessage({ stickerMessage, parentKey, associationType = STICKER_ANNOTATION } = {}) {
  if (!stickerMessage) throw new TypeError('An uploaded stickerMessage is required');
  if (!parentKey?.id) throw new TypeError('parentMessageKey with an id is required');

  return {
    messageContextInfo: {
      messageAssociation: { associationType, parentMessageKey: parentKey },
    },
    stickerMessage,
  };
}

/**
 * Send a sticker annotation on top of a message.
 *
 * @param {object} sock   Baileys socket
 * @param {string} jid    Destination chat (must be the parent's chat)
 * @param {object} opts
 * @param {object} opts.parentKey  Message key to annotate
 * @param {Buffer|string} opts.image  Image bytes (or a path sharp can read)
 * @param {object} [opts.quoted]
 */
export async function annotateWithSticker(sock, jid, { parentKey, image, quoted } = {}) {
  const webp = await toStickerWebp(image);

  // The sticker still has to be uploaded: relayMessage alone cannot encrypt or
  // host media, which is why the sample's plain `url` never renders.
  const content = await generateWAMessageContent(
    { sticker: webp, mimetype: 'image/webp' },
    { upload: sock.waUploadToServer }
  );
  if (!content?.stickerMessage) throw new Error('Sticker upload produced no stickerMessage');

  const message = buildAnnotationMessage({ stickerMessage: content.stickerMessage, parentKey });
  const generated = generateWAMessageFromContent(jid, message, {
    ...(sock.user?.id ? { userJid: sock.user.id } : {}),
    ...(quoted ? { quoted } : {}),
  });

  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
  return generated;
}

export default annotateWithSticker;
