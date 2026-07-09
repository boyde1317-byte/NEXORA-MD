/**
 * @file src/lib/waUtils.js
 * Reusable 0@s.whatsapp.net utilities for NEXORA-MD.
 *
 * Three families of helpers:
 *
 *   1. fakeQuote  — text message with a "WhatsApp"-branded quoted header
 *   2. adReply    — external ad-reply card (branded banner above a message)
 *   3. status     — post text / image / video to status@broadcast
 *
 * Every helper has two forms:
 *   send*(sock, jid, ...)  — raw form, works anywhere
 *   reply*(m, sock, ...)   — convenience form; auto-quotes the triggering message
 *
 * Usage in a plugin:
 *   import { replyFakeQuote, replyAdReply, sendStatus } from '../lib/waUtils.js'
 */

/** WhatsApp's own server JID — renders as "WhatsApp" in quoted headers */
export const WA_JID = '0@s.whatsapp.net'

/** Status broadcast pseudo-JID */
export const STATUS_JID = 'status@broadcast'

// ─────────────────────────────────────────────────────────────────────────────
// 1.  FAKE WHATSAPP QUOTE
//     The reply bar at the top of the message shows fakeText attributed to
//     WhatsApp itself (green bar, "WhatsApp" name).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a text message with a fake WhatsApp-branded quoted header.
 *
 * @param {import('baileys').WASocket} sock      Baileys socket
 * @param {string}                     jid       Destination chat JID
 * @param {string}                     text      Actual message body
 * @param {string}                    [fakeText] Text inside the green quote bar
 *                                               (defaults to an invisible space)
 * @param {object}                    [opts]     Extra options forwarded to sock.sendMessage
 * @returns {Promise<object>}                    Sent message proto
 *
 * @example
 * await sendFakeQuote(sock, m.from, 'Hello!', 'WhatsApp notification', { quoted: m })
 */
/**
 * Generate a Baileys-compatible fake stanza ID.
 * Quoted contextInfo requires a non-empty stanzaId or several WA clients
 * silently degrade the reply header to plain text.
 * Format mirrors real Baileys IDs: "3EB0" + 12 random hex chars (uppercase).
 * @returns {string}
 */
function fakeStanzaId() {
  const hex = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()
  return '3EB0' + hex() + hex()
}

export async function sendFakeQuote(sock, jid, text, fakeText = '\u200e', opts = {}) {
  return sock.sendMessage(jid, {
    text,
    contextInfo: {
      stanzaId:      fakeStanzaId(),   // required for reliable reply-bar rendering
      quotedMessage: { conversation: fakeText },
      participant:   WA_JID,           // "WhatsApp" shown as the quoted sender
      remoteJid:     jid,              // must be the actual destination chat, not WA_JID
    },
  }, opts)
}

/**
 * Convenience wrapper — takes the serialised `m` object and automatically
 * quotes the triggering message.
 *
 * @param {object}                     m          Serialised message (from serializer.js)
 * @param {import('baileys').WASocket} sock
 * @param {string}                     text       Message body
 * @param {string}                    [fakeText]  Text in the green quote bar
 * @param {object}                    [opts]      Extra options (merged after { quoted: m })
 *
 * @example
 * await replyFakeQuote(m, sock, '*NEXORA-MD* joined the chat.', 'WhatsApp')
 */
export async function replyFakeQuote(m, sock, text, fakeText = '\u200e', opts = {}) {
  return sendFakeQuote(sock, m.from, text, fakeText, { quoted: m, ...opts })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  EXTERNAL AD REPLY
//     A branded card (title + body + thumbnail + tap-to-open URL) floats
//     above the message text. Setting sourceId to WA_JID makes the card
//     appear to come from WhatsApp itself.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AdReplyOpts
 * @property {string}       title                    Card heading (bold)
 * @property {string}      [body]                    Card subtext / description
 * @property {Buffer}      [thumbnail]               Raw image buffer (preferred over thumbnailUrl)
 * @property {string}      [thumbnailUrl]            HTTPS URL of the thumbnail image
 * @property {string}      [sourceUrl]               URL opened when the card is tapped
 * @property {string}      [sourceId]                Source JID (default: WA_JID → "WhatsApp")
 * @property {1|2}         [mediaType]               1 = IMAGE (default), 2 = VIDEO
 * @property {boolean}     [renderLargerThumbnail]   Show large-image layout (default: false)
 * @property {boolean}     [showAdAttribution]       Show attribution label (default: true)
 */

/**
 * Send a text message topped with an external ad-reply card.
 *
 * @param {import('baileys').WASocket} sock
 * @param {string}      jid   Destination chat JID
 * @param {string}      text  Message body (shown below the card)
 * @param {AdReplyOpts} ad    Card configuration
 * @param {object}     [opts] Extra options forwarded to sock.sendMessage
 *
 * @example
 * await sendAdReply(sock, m.from, 'Check this out!', {
 *   title: 'NEXORA-MD',
 *   body:  'The next-gen WhatsApp bot',
 *   thumbnailUrl: 'https://example.com/logo.jpg',
 *   sourceUrl:    'https://github.com/Boyde1317-byte/NEXORA-MD',
 * }, { quoted: m })
 */
export async function sendAdReply(sock, jid, text, ad = {}, opts = {}) {
  const card = {
    title:                 ad.title                 ?? 'WhatsApp',
    body:                  ad.body                  ?? '',
    sourceUrl:             ad.sourceUrl             ?? 'https://whatsapp.com',
    sourceId:              ad.sourceId              ?? WA_JID,
    mediaType:             ad.mediaType             ?? 1,
    renderLargerThumbnail: ad.renderLargerThumbnail ?? false,
    showAdAttribution:     ad.showAdAttribution     ?? true,
  }

  // Buffer thumbnail takes priority over a URL string
  if (ad.thumbnail)         card.thumbnail    = ad.thumbnail
  else if (ad.thumbnailUrl) card.thumbnailUrl = ad.thumbnailUrl

  return sock.sendMessage(jid, {
    text,
    contextInfo: { externalAdReply: card },
  }, opts)
}

/**
 * Convenience wrapper — takes `m` and automatically quotes the triggering message.
 *
 * @param {object}                     m     Serialised message
 * @param {import('baileys').WASocket} sock
 * @param {string}                     text  Message body
 * @param {AdReplyOpts}                ad    Card configuration
 * @param {object}                    [opts] Extra options
 *
 * @example
 * await replyAdReply(m, sock, 'Bot info', {
 *   title: 'NEXORA-MD v2',
 *   body:  'Type .menu for commands',
 *   thumbnailUrl: 'https://example.com/banner.jpg',
 * })
 */
export async function replyAdReply(m, sock, text, ad = {}, opts = {}) {
  return sendAdReply(sock, m.from, text, ad, { quoted: m, ...opts })
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  STATUS BROADCAST
//     Sends a text, image, or video status visible to the contacts listed in
//     statusJidList.  An empty list means all saved contacts can see it
//     (Baileys default behaviour).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} StatusOpts
 * @property {string[]}     [statusJidList]    Contacts who can see the status (default: [])
 * @property {string}       [backgroundColor]  Hex colour for text statuses (default: '#25D366')
 * @property {0|1|2|3|4|5} [font]             Font style index 0–5 for text (default: 0)
 * @property {string}       [caption]          Caption for image / video statuses
 */

/**
 * Post a text status to status@broadcast.
 *
 * @param {import('baileys').WASocket} sock
 * @param {string}     text  Status text content
 * @param {StatusOpts} [opts]
 *
 * @example
 * await sendTextStatus(sock, 'Bot is online!', {
 *   backgroundColor: '#128C7E',
 *   statusJidList: ['233597514499@s.whatsapp.net'],
 * })
 */
export async function sendTextStatus(sock, text, opts = {}) {
  const { statusJidList = [], backgroundColor = '#25D366', font = 0 } = opts
  return sock.sendMessage(
    STATUS_JID,
    { text, backgroundColor, font },
    { statusJidList },
  )
}

/**
 * Post an image status.
 *
 * @param {import('baileys').WASocket} sock
 * @param {Buffer|string} image  Image buffer or HTTPS URL string
 * @param {StatusOpts}   [opts]
 *
 * @example
 * await sendImageStatus(sock, 'https://example.com/banner.jpg', {
 *   caption: 'New update dropped!',
 * })
 */
export async function sendImageStatus(sock, image, opts = {}) {
  const { statusJidList = [], caption = '' } = opts
  const content = typeof image === 'string'
    ? { image: { url: image }, caption }
    : { image, caption }
  return sock.sendMessage(STATUS_JID, content, { statusJidList })
}

/**
 * Post a video status.
 *
 * @param {import('baileys').WASocket} sock
 * @param {Buffer|string} video  Video buffer or HTTPS URL string
 * @param {StatusOpts}   [opts]
 *
 * @example
 * await sendVideoStatus(sock, videoBuffer, { caption: 'Watch this!' })
 */
export async function sendVideoStatus(sock, video, opts = {}) {
  const { statusJidList = [], caption = '' } = opts
  const content = typeof video === 'string'
    ? { video: { url: video }, caption, gifPlayback: false }
    : { video, caption, gifPlayback: false }
  return sock.sendMessage(STATUS_JID, content, { statusJidList })
}

/**
 * Unified status dispatcher — picks the right sender based on `type`.
 *
 * @param {import('baileys').WASocket}  sock
 * @param {'text'|'image'|'video'}     type     Media kind (default: 'text')
 * @param {string|Buffer}              content  Text, image/video buffer, or URL
 * @param {StatusOpts}                [opts]
 *
 * @example
 * // Text status
 * await sendStatus(sock, 'text', 'Going offline for maintenance.')
 *
 * // Image via URL
 * await sendStatus(sock, 'image', 'https://example.com/photo.jpg', { caption: 'Fresh drop' })
 *
 * // Video via buffer
 * await sendStatus(sock, 'video', videoBuffer, { caption: 'Check this out' })
 */
export async function sendStatus(sock, type = 'text', content, opts = {}) {
  if (!sock)    throw new TypeError('sendStatus: sock is required')
  if (!content && content !== 0) throw new TypeError('sendStatus: content is required')

  const validTypes = ['text', 'image', 'video']
  if (!validTypes.includes(type)) {
    throw new TypeError(`sendStatus: invalid type "${type}" — must be one of: ${validTypes.join(', ')}`)
  }

  switch (type) {
    case 'image': return sendImageStatus(sock, content, opts)
    case 'video': return sendVideoStatus(sock, content, opts)
    default:      return sendTextStatus(sock, String(content), opts)
  }
}
