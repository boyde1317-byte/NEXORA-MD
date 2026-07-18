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

// ─────────────────────────────────────────────────────────────────────────────
// 0.  FAKE QUOTED CONTEXT BUILDERS
//     These build a synthetic WAMessage object to pass as { quoted: ... }.
//     WhatsApp renders the `.message` content in the reply bar above your
//     message — the type you choose determines what the card looks like:
//       buildFakeOrderQuote   → business order card  (thumbnail + item count + title)
//       buildFakeContactQuote → contact card          (name + contact icon)
//     Both use 0@s.whatsapp.net as participant (renders as "WhatsApp") and
//     status@broadcast as remoteJid (prevents WA trying to load the original).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fake orderMessage quoted context.
 * Pass the result as `{ quoted: buildFakeOrderQuote(...) }` to any sock.sendMessage call.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]      Text shown as the order title in the reply bar
 * @param {Buffer}  [opts.thumbnail]  Image buffer shown as the order thumbnail
 * @param {number|string} [opts.itemCount=1]  Item count displayed on the card
 * @param {string}  [opts.orderId]    Order ID string (any value, cosmetic only)
 *
 * @example
 * const fakeQuote = buildFakeOrderQuote({ title: 'NEXORA MENU', thumbnail: imgBuffer, itemCount: 42 })
 * await sock.sendMessage(m.from, { text: 'Hello' }, { quoted: fakeQuote })
 */
export function buildFakeOrderQuote({ title, thumbnail, itemCount = 1, orderId, orderTitle, sellerJid } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      orderMessage: {
        orderId:    orderId    || String(Date.now()).slice(-6),
        thumbnail:  thumbnail  || undefined,
        itemCount:  Number(itemCount),   // int32 — proto rejects strings
        status:     'INQUIRY',
        surface:    'CATALOG',
        message:    title      || 'NEXORA-MD',
        orderTitle: orderTitle || undefined,   // shown as bold heading above itemCount
        sellerJid:  sellerJid  || WA_JID,     // business seller JID
        token:      'AR6Nexora==',
      }
    }
  }
}



/**
 * Build a fake contactMessage quoted context.
 * Renders as a contact card (name + contact icon) in the reply bar.
 * Pass the result as `{ quoted: buildFakeContactQuote(...) }`.
 *
 * @param {object} [opts]
 * @param {string} [opts.displayName]  Contact name shown in the reply bar
 * @param {string} [opts.phoneNumber]  Phone number (digits only or E.164)
 * @param {string} [opts.vcard]        Full vCard string — generated automatically if omitted
 *
 * @example
 * const fakeQuote = buildFakeContactQuote({ displayName: 'NEXORA SUPPORT', phoneNumber: '233533416608' })
 * await sock.sendMessage(m.from, { text: 'Hello' }, { quoted: fakeQuote })
 */
export function buildFakeContactQuote({ displayName, phoneNumber, vcard } = {}) {
  const cleanNumber = (phoneNumber || '').replace(/[^\d]/g, '')
  const vcardStr = vcard || [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${displayName || 'NEXORA'}`,
    cleanNumber ? `TEL;type=CELL;waid=${cleanNumber}:+${cleanNumber}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n')

  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      // ContactMessage proto (verified): only displayName, vcard, contextInfo.
      // No jpegThumbnail or thumbnail field exists — WA derives the avatar
      // from the contact's actual profile picture, not from the message proto.
      contactMessage: {
        displayName: displayName || 'NEXORA',
        vcard:       vcardStr,
      }
    }
  }
}

/**
 * Build a fake audioMessage quoted context.
 * Renders as a voice-note waveform + duration in the reply bar.
 *
 * IMPORTANT — WA CDN URLs expire. Two usage modes:
 *
 *   1. Pass a full `audioMessage` proto captured from a received ptt/audio message
 *      (the `.message.audioMessage` field of the WAMessage object Baileys gives you).
 *      This produces a fully playable voice-note preview in the reply bar.
 *
 *   2. Omit `audioMessage`. A minimal shell is built — renders the voice-note icon
 *      and duration (`seconds`) in the reply bar but is not playable. Still visually
 *      impactful.
 *
 * @param {object}  [opts]
 * @param {object}  [opts.audioMessage]  Full audioMessage proto from a received message
 * @param {number}  [opts.seconds=9999999]  Duration shown on the waveform (cosmetic if no real audio)
 * @param {boolean} [opts.ptt=true]      True = voice note waveform, false = audio file icon
 *
 * @example
 * // Shell (not playable, but renders the waveform):
 * const fakeQuote = buildFakeAudioQuote({ seconds: 9999999 })
 *
 * // Real audio from a received message:
 * const fakeQuote = buildFakeAudioQuote({ audioMessage: receivedMsg.message.audioMessage })
 *
 * await sock.sendMessage(m.from, { text: menuText }, { quoted: fakeQuote })
 */
export function buildFakeAudioQuote({ audioMessage, seconds = 9999999, ptt = true } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      audioMessage: audioMessage || {
        // Minimal shell — visible in reply bar as a voice note icon + duration.
        // mediaKey / fileSha256 / fileEncSha256 are zeroed-out buffers so the
        // proto serialises without errors; the audio itself is not playable.
        mimetype:       'audio/mp4',
        seconds,
        ptt,
        fileLength:     0,                  // uint64 — number, not string
        mediaKey:       Buffer.alloc(32),
        fileSha256:     Buffer.alloc(32),
        fileEncSha256:  Buffer.alloc(32),
      },
    },
  }
}

/**
 * Build a fake locationMessage quoted context.
 * Renders as a compact location card (📍 name + address) in the reply bar —
 * NOT a full map tile. The coordinates satisfy the proto requirement but are
 * not shown to the user; name and address are the displayed content.
 *
 * Pass the result as `{ quoted: buildFakeLocationQuote(...) }` to any
 * sock.sendMessage / baileysBridge call.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.name]              Location name shown in the reply bar
 * @param {string}  [opts.address]           Address / subtitle line
 * @param {number}  [opts.degreesLatitude=0]
 * @param {number}  [opts.degreesLongitude=0]
 *
 * @example
 * const fakeQuote = buildFakeLocationQuote({ name: 'NEXORA HQ', address: 'Bot Command Console' })
 * await sock.sendMessage(m.from, { text: menuText }, { quoted: fakeQuote })
 */
export function buildFakeLocationQuote({
  name             = 'NEXORA-MD',
  address          = 'Bot Command Console',
  degreesLatitude  = 6.6745,
  degreesLongitude = -1.5716,
  jpegThumbnail,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      locationMessage: {
        degreesLatitude,
        degreesLongitude,
        name,
        address,
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake liveLocationMessage quoted context.
 *
 * Renders differently from a regular locationMessage — shows as a "Live Location"
 * card with caption text and optional thumbnail in the reply bar. This is the
 * preferred quote type for the location menu style.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.caption]          Text shown on the live location card
 * @param {string}  [opts.name]             Alias for caption
 * @param {Buffer}  [opts.jpegThumbnail]    Thumbnail image shown on the card
 * @param {number}  [opts.degreesLatitude]
 * @param {number}  [opts.degreesLongitude]
 * @param {number}  [opts.forwardingScore]  Adds forwarded badge when set
 */
export function buildFakeLiveLocationQuote({
  caption,
  name,
  jpegThumbnail,
  degreesLatitude  = 6.6745,
  degreesLongitude = -1.5716,
  sequenceNumber,
  forwardingScore,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      liveLocationMessage: {
        degreesLatitude,
        degreesLongitude,
        caption:        caption || name || 'NEXORA-MD',
        sequenceNumber: sequenceNumber || Date.now(),  // int64 — number, not string
        jpegThumbnail:  jpegThumbnail  || undefined,
        ...(forwardingScore != null ? {
          contextInfo: { forwardingScore, isForwarded: true },
        } : {}),
      },
    },
  }
}

/**
 * Build a fake extendedTextMessage quoted context.
 * Renders as a rich text card in the reply bar — title + body text + optional thumbnail.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.text]          Body text shown in the reply bar
 * @param {string}  [opts.title]         Bold heading above the text
 * @param {Buffer}  [opts.jpegThumbnail] Thumbnail shown alongside the text
 */
// ExtendedTextMessage proto (verified): text(1), matchedText(2), description(5),
// title(6), font(9), previewType(10), jpegThumbnail(16), contextInfo(17) — all valid.
export function buildFakeTextQuote({ text, title, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      extendedTextMessage: {
        text:          text          || 'NEXORA-MD',
        title:         title         || undefined,
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake documentMessage quoted context.
 * Renders as a document card (file icon + title) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]         Document title / filename shown
 * @param {string}  [opts.fileName]      File name (default: nexora.pdf)
 * @param {string}  [opts.mimetype]      MIME type (default: application/pdf)
 * @param {Buffer}  [opts.jpegThumbnail] Preview thumbnail
 */
export function buildFakeDocumentQuote({ title, fileName, mimetype, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      documentMessage: {
        title:         title         || 'NEXORA-MD',
        fileName:      fileName      || 'nexora.pdf',
        mimetype:      mimetype      || 'application/pdf',
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake imageMessage quoted context.
 * Renders as an image thumbnail in the reply bar.
 * Pass a real `jpegThumbnail` buffer for a visible image; without it WA shows
 * a grey placeholder.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.url]           CDN URL (cosmetic — expires; thumbnail is what shows)
 * @param {Buffer}  [opts.jpegThumbnail] Actual visible thumbnail in the reply bar
 * @param {boolean} [opts.viewOnce=false] Mark as view-once
 * @param {number}  [opts.height=306]
 * @param {number}  [opts.width=366]
 */
export function buildFakeImageQuote({ url, jpegThumbnail, viewOnce = false, height = 306, width = 366 } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      imageMessage: {
        url:           url           || '',
        mimetype:      'image/jpeg',
        jpegThumbnail: jpegThumbnail || undefined,
        fileLength:    0,            // uint64 — number, not string
        height,
        width,
        ...(viewOnce ? { viewOnce: true } : {}),
      },
    },
  }
}

/**
 * Build a fake videoMessage quoted context with gifPlayback.
 * Renders as an animated GIF preview / video card in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]         Card title
 * @param {string}  [opts.caption]       Caption text
 * @param {Buffer}  [opts.jpegThumbnail] Preview frame thumbnail
 * @param {number}  [opts.seconds=999999999] Duration (cosmetic)
 * @param {boolean} [opts.gifPlayback=true]  GIF loop mode
 */
// VideoMessage proto (verified): no `title` field exists — removed.
// seconds = uint32, fileLength = uint64 — must be numbers, not strings.
export function buildFakeGifQuote({ caption, jpegThumbnail, seconds = 999999999, gifPlayback = true } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      videoMessage: {
        caption:       caption       || '',
        jpegThumbnail: jpegThumbnail || undefined,
        seconds:       Number(seconds),   // uint32
        gifPlayback,
        mimetype:      'video/mp4',
        fileLength:    0,                 // uint64
      },
    },
  }
}

/**
 * Build a fake productMessage quoted context.
 * Renders as a product catalogue card (image + name + price) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]            Product name
 * @param {string}  [opts.description]      Product description
 * @param {string}  [opts.currencyCode]     ISO 4217 currency (default: 'USD')
 * @param {string}  [opts.priceAmount1000]  Price × 1000 (e.g. "20000" = $20.00)
 * @param {Buffer}  [opts.jpegThumbnail]    Product image thumbnail
 * @param {string}  [opts.businessOwnerJid] Business JID
 */
// NOTE: productMessage as a fake quote renders best on WA Business accounts
// or in catalog contexts. On regular accounts WA still shows the card but
// may show a "view product" placeholder rather than full product details.
export function buildFakeProductQuote({
  title,
  description,
  currencyCode     = 'USD',
  priceAmount1000  = 1000,
  jpegThumbnail,
  businessOwnerJid,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
    },
    message: {
      productMessage: {
        product: {
          productImage: {
            mimetype:      'image/jpeg',
            jpegThumbnail: jpegThumbnail || undefined,
          },
          title:               title             || 'NEXORA-MD',
          description:         description       || '',
          currencyCode,
          priceAmount1000:     Number(priceAmount1000),  // int64 — number, not string
          productImageCount:   1,
        },
        businessOwnerJid: businessOwnerJid || WA_JID,
      },
    },
  }
}

/**
 * Build a fake groupInviteMessage quoted context.
 * Renders as a group invite card (group name + join button) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.groupJid]      The group JID (can be fake)
 * @param {string}  [opts.inviteCode]    Invite code (cosmetic — 'null' is accepted)
 * @param {string}  [opts.groupName]     Group name shown on the card
 * @param {string}  [opts.caption]       Caption / description text
 * @param {Buffer}  [opts.jpegThumbnail] Group icon thumbnail
 */
export function buildFakeGroupInviteQuote({ groupJid, inviteCode = 'null', groupName, caption, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   WA_JID,
    },
    message: {
      groupInviteMessage: {
        groupJid:      groupJid      || WA_JID,
        inviteCode,
        groupName:     groupName     || 'NEXORA-MD',
        caption:       caption       || '',
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake requestPaymentMessage quoted context.
 * Renders as a payment request card in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.currencyCode]    ISO 4217 code (default: 'USD')
 * @param {string}  [opts.amount1000]      Amount × 1000 (e.g. '5000' = $5.00)
 * @param {string}  [opts.note]            Note text on the payment card
 * @param {string}  [opts.expiryTimestamp] Unix ms timestamp (defaults to 24h from now)
 */
// NOTE: requestPaymentMessage renders correctly only in WA Pay regions
// (Brazil, India, Singapore, etc.). In unsupported regions WA client may
// show a generic "payment" icon or an unknown-message placeholder.
// Still valid as a fake quoted context — the proto fields are correct.
export function buildFakePaymentQuote({ currencyCode = 'USD', amount1000 = 1000, note, expiryTimestamp } = {}) {
  const amt = Number(amount1000)
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   WA_JID,
    },
    message: {
      requestPaymentMessage: {
        currencyCodeIso4217: currencyCode,
        amount1000:          amt,                                  // uint64 — number
        requestFrom:         WA_JID,
        // noteMessage is optional Message — wraps extendedTextMessage
        noteMessage: {
          extendedTextMessage: { text: note || 'NEXORA-MD' },
        },
        expiryTimestamp: expiryTimestamp || (Date.now() + 86_400_000), // int64 — number
        // Money proto: value = raw amount (same as amount1000), offset = scale (1000)
        amount: {
          value:        amt,         // int64
          offset:       1000,        // uint32 — divide value by offset for display amount
          currencyCode,
        },
      },
    },
  }
}

/**
 * Pick a random fake quote from the full pool of available builders.
 * Useful for adding variety to greetings, welcome messages, or any send
 * where the specific quote type doesn't matter.
 *
 * @param {object} [perTypeOpts]  Optional per-type option overrides keyed by builder name:
 *   { order, contact, audio, liveLocation, location, text, document, image, gif, product, groupInvite, payment }
 *
 * @example
 * await sock.sendMessage(m.from, { text: 'Hello!' }, { quoted: buildRandomFakeQuote() })
 */
export function buildRandomFakeQuote(perTypeOpts = {}) {
  const pool = [
    () => buildFakeOrderQuote(perTypeOpts.order || {}),
    () => buildFakeContactQuote(perTypeOpts.contact || {}),
    () => buildFakeAudioQuote(perTypeOpts.audio || {}),
    () => buildFakeLiveLocationQuote(perTypeOpts.liveLocation || {}),
    () => buildFakeLocationQuote(perTypeOpts.location || {}),
    () => buildFakeTextQuote(perTypeOpts.text || {}),
    () => buildFakeDocumentQuote(perTypeOpts.document || {}),
    () => buildFakeImageQuote(perTypeOpts.image || {}),
    () => buildFakeGifQuote(perTypeOpts.gif || {}),
    () => buildFakeProductQuote(perTypeOpts.product || {}),
    () => buildFakeGroupInviteQuote(perTypeOpts.groupInvite || {}),
    () => buildFakePaymentQuote(perTypeOpts.payment || {}),
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
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
/**
 * Build the `contextInfo` block for an externalAdReply card (title/body/
 * thumbnail banner) plus its related optional badges (forwarded, newsletter,
 * mentions). Shared by `sendAdReply` and by `actionCardWithAd` in
 * interactiveKit.js, so a single interactive message can carry both the ad
 * banner AND nativeFlow buttons instead of needing two separate messages.
 *
 * @param {AdReplyOpts} ad
 * @returns {object} contextInfo fragment — merge into any sendMessage/
 *                    interactiveMessage contextInfo object.
 */
export function buildAdReplyContext(ad = {}) {
  const card = {
    title:                 ad.title                 ?? 'WhatsApp',
    body:                  ad.body                  ?? '',
    sourceUrl:             ad.sourceUrl             ?? 'https://whatsapp.com',
    sourceId:              ad.sourceId              ?? WA_JID,
    mediaType:             ad.mediaType             ?? 1,
    renderLargerThumbnail: ad.renderLargerThumbnail ?? false,
    showAdAttribution:     ad.showAdAttribution     ?? true,
  }

  // Optional visible fields
  if (ad.description)         card.description         = ad.description   // subtitle below body
  if (ad.previewType)         card.previewType         = ad.previewType   // e.g. 'PHOTO'
  if (ad.mediaUrl)            card.mediaUrl            = ad.mediaUrl       // media CDN URL
  if (ad.containsAutoReply)   card.containsAutoReply   = true             // auto-reply badge

  // Buffer thumbnail takes priority over a URL string
  if (ad.thumbnail)         card.thumbnail    = ad.thumbnail
  else if (ad.thumbnailUrl) card.thumbnailUrl = ad.thumbnailUrl

  const contextInfo = { externalAdReply: card }

  // Optional: "Forwarded" / "Forwarded many times" badge (score > 5 = "many times")
  if (ad.forwardingScore != null) {
    contextInfo.forwardingScore = ad.forwardingScore
    contextInfo.isForwarded     = true
  }

  // Optional: Channel forward-origin badge — shows newsletterName above the message
  if (ad.newsletterJid) {
    contextInfo.forwardedNewsletterMessageInfo = {
      newsletterJid:      ad.newsletterJid,
      serverMessageId:    1,
      newsletterName:     ad.newsletterName     || '',
      contentType:        1,
      accessibilityText:  ad.newsletterName     || '',
    }
    contextInfo.isForwarded = true
  }

  // Optional: mentionedJid list (triggers notification for those users)
  if (Array.isArray(ad.mentionedJid) && ad.mentionedJid.length) {
    contextInfo.mentionedJid = ad.mentionedJid
  }

  return contextInfo
}

export async function sendAdReply(sock, jid, text, ad = {}, opts = {}) {
  const contextInfo = buildAdReplyContext(ad)
  return sock.sendMessage(jid, { text, contextInfo }, opts)
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
