import { generateWAMessageFromContent, generateWAMessage, generateMessageID, generateMessageIDV2, proto } from 'baileys';
import { randomBytes, getRandomValues } from 'node:crypto';

// ─── Rich message helpers (inlined so we don't rely on a deep import path) ───
// Mirrors wrapToBotForwardedMessage + botMetadata* from the fork's
// lib/Utils/rich-message-utils.js so richResponseMessage renders with the
// Meta AI bot badge without requiring `baileys/lib/Utils/rich-message-utils.js`
// to be individually accessible (exports-map varies by install method).
function _botCert(length = 685) {
  const c = Buffer.alloc(length); c[0] = 48; c[1] = 130;
  getRandomValues(c.subarray(2)); return c;
}
function _buildBotForwardedMessage(richResponseMessage, disclaimerText) {
  const sig = Buffer.alloc(64); getRandomValues(sig);
  const msg = {
    messageContextInfo: {
      botMetadata: {
        verificationMetadata: {
          proofs: [{ certificateChain: [_botCert(685), _botCert(892)], version: 1, useCase: 1, signature: sig }],
        },
        ...(disclaimerText ? { messageDisclaimerText: disclaimerText } : {}),
      },
    },
    botForwardedMessage: { message: { richResponseMessage } },
  };
  return msg;
}

/**
 * Unified facade for interfacing with the custom Baileys fork.
 * This encapsulates all raw Baileys structures and methods so that
 * the rest of the menu and bot system doesn't rely on raw protobuf constructs.
 */
export const baileysBridge = {
  /**
   * Simple wrapper for sending a message using Baileys sock
   */
  async sendMessage(sock, jid, content, options = {}) {
    return await sock.sendMessage(jid, content, options);
  },

  /**
   * Relays a fully formed proto.IMessage payload directly to WhatsApp servers.
   *
   * IMPORTANT: several message types (eventMessage, pollCreationMessage*,
   * interactiveMessage w/ nativeFlow, productMessage) require a top-level
   * messageContextInfo.messageSecret so WhatsApp clients can decrypt/render
   * them — this is unrelated to viewOnceMessage. Do NOT wrap these types in
   * viewOnceMessage just to get a secret injected; viewOnceMessage carries
   * real self-destruct-after-one-view semantics and most clients drop
   * eventMessage/productMessage/interactiveMessage payloads placed inside it.
   * We inject the secret centrally, keyed off message type, so callers never
   * need the viewOnceMessage workaround.
   */
  async relayMessage(sock, jid, messageContent, options = {}) {
    // Build the messageContextInfo block. When options.aiMessage is true, attach
    // supportPayload so WA clients render the Meta AI badge on the message.
    const _buildContextInfo = (existing) => {
      if (existing) return existing;
      const base = {
        deviceListMetadata:        {},
        deviceListMetadataVersion: 2,
        messageSecret:             randomBytes(32),
      };
      if (options.aiMessage) {
        base.supportPayload = JSON.stringify({
          version:                   2,
          is_ai_message:             true,
          should_show_system_message: true,
          ticket_id:                 randomBytes(16).toString('base64'),
        });
      }
      return base;
    };

    // viewOnceMessage — real view-once sends
    if (messageContent.viewOnceMessage?.message) {
      const inner = messageContent.viewOnceMessage.message;
      inner.messageContextInfo = _buildContextInfo(inner.messageContextInfo);

    // ephemeralMessage — disappearing-message wrapper (same secret injection needed)
    } else if (messageContent.ephemeralMessage?.message) {
      const inner = messageContent.ephemeralMessage.message;
      inner.messageContextInfo = _buildContextInfo(inner.messageContextInfo);

    } else {
      // Flat payload: inject messageSecret for types that require it
      // Message types that need a messageContextInfo.messageSecret so WA clients can
      // decrypt/render them. Extended for new message types in the fork.
      const SECRET_REQUIRED_KEYS = [
        'eventMessage',
        'productMessage',
        'interactiveMessage',
        'pollCreationMessage',
        'pollCreationMessageV2',
        'pollCreationMessageV3',
        'stickerPackMessage',        // new in fork — sticker pack sends
        'lottieStickerMessage',      // new in fork — animated lottie stickers
        'pollResultSnapshotMessage', // new in fork — poll result snapshots
      ];
      const hasSecretRequiredType = SECRET_REQUIRED_KEYS.some(key => key in messageContent);
      if (hasSecretRequiredType) {
        messageContent.messageContextInfo = _buildContextInfo(messageContent.messageContextInfo);
      }
    }

    const message = await generateWAMessageFromContent(jid, messageContent, {
      userJid: sock.user?.id || '0@s.whatsapp.net',
      quoted: options.quoted,
    });

    // sock.relayMessage only accepts MessageRelayOptions — do not spread `options`
    // as it contains `quoted` which is not a valid relay param.
    await sock.relayMessage(jid, message.message, { messageId: message.key.id });
    return message;
  },

  /**
   * Uploads a raw image payload (buffer/url/stream — the same shape you'd
   * pass to sock.sendMessage({ image: ... })) to WhatsApp's media servers
   * and returns a fully-formed proto.Message.IImageMessage (url, mediaKey,
   * fileEncSha256, directPath, etc). Headers/cards embedding an image MUST
   * use this — passing a raw buffer/url object directly as `imageMessage`
   * produces an invalid proto with hasMediaAttachment:true but no real
   * media behind it, so WhatsApp shows no image (or drops the message).
   */
  async _uploadImageMessage(sock, jid, imageContent, options = {}) {
    // Already an uploaded proto (has fileSha256/mediaKey) — pass through untouched.
    if (imageContent?.fileSha256 || imageContent?.mediaKey) {
      return imageContent;
    }
    const msg = await generateWAMessage(
      jid,
      { image: imageContent },
      {
        upload: sock.waUploadToServer,
        userJid: sock.user?.id || '0@s.whatsapp.net',
        quoted: options.quoted,
      },
    );
    return msg.message.imageMessage;
  },

  /**
   * Uploads a raw video payload to WhatsApp's media servers and returns a fully-formed
   * proto.Message.IVideoMessage. Interactive message headers embedding video MUST use
   * this for the same reason as _uploadImageMessage — raw buffer/url produces an
   * invalid proto with no real media behind hasMediaAttachment:true.
   */
  async _uploadVideoMessage(sock, jid, videoContent, options = {}) {
    if (videoContent?.fileSha256 || videoContent?.mediaKey) {
      return videoContent;
    }
    const msg = await generateWAMessage(
      jid,
      { video: videoContent },
      {
        upload: sock.waUploadToServer,
        userJid: sock.user?.id || '0@s.whatsapp.net',
        quoted: options.quoted,
      },
    );
    return msg.message.videoMessage;
  },

  /**
   * Sends a premium Interactive Message (standard or custom).
   *
   * @param {object} opts
   * @param {string}  opts.body                     Card body text
   * @param {string}  [opts.footer]                 Card footer text
   * @param {object}  [opts.header]                 Header config:
   *   @param {string}  [opts.header.title]
   *   @param {string}  [opts.header.subtitle]
   *   @param {*}       [opts.header.image]          Buffer, {url}, or stream → uploaded automatically
   *   @param {*}       [opts.header.video]          Buffer, {url}, or stream → uploaded automatically
   *   @param {object}  [opts.header.documentMessage] Pre-built document proto
   *   @param {object}  [opts.header.imageMessage]    Pre-built image proto (skips upload)
   *   @param {object}  [opts.header.videoMessage]    Pre-built video proto (skips upload)
   * @param {Array}   [opts.buttons]                nativeFlow buttons [{name, params}]
   * @param {object}  [opts.contextInfo]            contextInfo placed INSIDE interactiveMessage.
   *   Supports: businessMessageForwardInfo, externalAdReply, forwardingScore, mentionedJid, etc.
   *   businessOwnerJid shorthand: pass options.businessOwnerJid instead of building
   *   contextInfo.businessMessageForwardInfo manually.
   *
   * @param {object}  [options]                     sendMessage/relayMessage options
   * @param {object}  [options.quoted]              Quoted message (e.g. buildFakeOrderQuote())
   * @param {string}  [options.businessOwnerJid]    Shorthand: sets businessMessageForwardInfo
   * @param {boolean} [options.aiMessage]           Add supportPayload → Meta AI badge
   */
  async sendInteractive(sock, jid, { body, footer, header, buttons, contextInfo }, options = {}) {
    // ── Header media upload ───────────────────────────────────────────────
    let headerImageMessage = header?.imageMessage;
    if (!headerImageMessage && header?.image) {
      headerImageMessage = await this._uploadImageMessage(sock, jid, header.image, options);
    }

    let headerVideoMessage = header?.videoMessage;
    if (!headerVideoMessage && header?.video) {
      headerVideoMessage = await this._uploadVideoMessage(sock, jid, header.video, options);
    }

    // ── interactiveMessage.contextInfo ───────────────────────────────────
    // Placed INSIDE the interactiveMessage (not top-level messageContextInfo).
    // Enables businessMessageForwardInfo, embedded externalAdReply, stanzaId, etc.
    let interactiveContextInfo;
    if (contextInfo || options.businessOwnerJid) {
      interactiveContextInfo = { ...(contextInfo || {}) };
      if (options.businessOwnerJid && !interactiveContextInfo.businessMessageForwardInfo) {
        interactiveContextInfo.businessMessageForwardInfo = {
          businessOwnerJid: options.businessOwnerJid,
        };
      }
    }

    const msgContent = {
      interactiveMessage: {
        body:   { text: body },
        footer: { text: footer || '' },
        header: header ? {
          title:    header.title    || '',
          subtitle: header.subtitle || '',
          // Auto-derive: true only for actual media (image/video/document).
          // locationMessage header always has hasMediaAttachment: false.
          hasMediaAttachment: !!(
            header.hasMediaAttachment ||
            headerImageMessage        ||
            headerVideoMessage        ||
            header.documentMessage
          ),
          ...(header.documentMessage  ? { documentMessage:  header.documentMessage }  : {}),
          ...(headerImageMessage      ? { imageMessage:     headerImageMessage }      : {}),
          ...(headerVideoMessage      ? { videoMessage:     headerVideoMessage }      : {}),
          ...(header.locationMessage  ? { locationMessage:  header.locationMessage }  : {}),
        } : undefined,
        nativeFlowMessage: buttons ? {
          buttons: buttons.map(btn => ({
            name:             btn.name || 'quick_reply',
            buttonParamsJson: typeof btn.params === 'string'
              ? btn.params
              : JSON.stringify(btn.params || {}),
          })),
        } : undefined,
        ...(interactiveContextInfo ? { contextInfo: interactiveContextInfo } : {}),
      },
    };

    return await this.relayMessage(sock, jid, msgContent, options);
  },

  /**
   * Sends an advanced Native Flow interactive message with quick replies, buttons, urls
   */
  async sendNativeFlow(sock, jid, {
    text, footer, title, image, video,
    buttons,
    offerText, offerUrl, offerCode, offerExpiry,
    optionText, optionTitle,
  }, options = {}) {
    // Route through sock.sendMessage → generateWAMessageContent (nativeFlow path).
    //
    // Button format — use the fork's simple declarative style (prepareNativeFlowButtons):
    //   { text: 'Label', id:   '.cmd'        }  → quick_reply
    //   { text: 'Label', url:  'https://...' }  → cta_url (merchant_url auto-set)
    //   { text: 'Label', copy: 'code'        }  → cta_copy
    //   { text: 'Label', call: '+1234'       }  → cta_call
    //   { text: 'Label', sections: [...]     }  → single_select list picker
    //
    // offerText    → limited_time_offer overlay banner (messageParamsJson)
    // optionText   → native bottom_sheet button that collapses all rows into a modal sheet
    // optionTitle  → title shown at the top of that sheet
    // image/video  → header media (Buffer or { url: '...' })
    //
    // FORK QUIRK (lib/Utils/messages.js, nativeFlow branch): the header/media
    // block that uploads `image`/`video` into the interactive header is only
    // entered when the body is passed as `caption`. If `text` is present,
    // `interactiveMessage.body = { text }` is set immediately and the entire
    // header branch — the one that calls `hasValidInteractiveHeader(m)` and
    // merges the uploaded image/video into `interactiveMessage.header` — is
    // skipped, even though `image`/`video` was set on the payload. So any
    // caller that passes both `text` and `image` silently loses the image.
    // We must send `caption` (not `text`) whenever media is attached; `title`
    // becomes the header title text in that path.
    const hasMedia = !!(image || video);
    return await sock.sendMessage(jid, {
      nativeFlow: buttons,
      ...(hasMedia ? { caption: text, title: title || '' } : { text }),
      footer,
      ...(!hasMedia && title ? { title }                                     : {}),
      ...(image     ? { image }                                             : {}),
      ...(video     ? { video }                                             : {}),
      ...(offerText  ? {
        offerText,
        offerUrl: offerUrl || '',
        ...(offerCode  ? { offerCode }               : {}),
        ...(offerExpiry ? { offerExpiration: offerExpiry } : {}),
      } : {}),
      ...(optionText ? {
        optionText,
        optionTitle: optionTitle || '📄 Options',
      } : {}),
    }, options);
  },

  /**
   * Sends a Request Payment message using the fork's native capability
   */
  async sendPayment(sock, jid, { amount, currency, note, expiry, background, image }, options = {}) {
    // The fork natively handles requestPaymentMessage inside sendMessage
    return await sock.sendMessage(jid, {
      requestPaymentMessage: {
        amount: amount || 10000, // standard smallest unit * 1000
        currency: currency || 'USD',
        note: note || 'AI Bot Premium Menu Invoice',
        expiry: expiry || Math.floor(Date.now() / 1000) + 86400,
        ...(image ? { background: { image } } : background ? { background } : {})
      }
    }, options);
  },

  /**
   * Sends a custom Event Invitation card.
   * Routes through sock.sendMessage so the fork's handleEvent applies the
   * required viewOnceMessage + supportPayload wrapper before relaying.
   * Relaying a flat eventMessage directly via generateWAMessageFromContent
   * skips this wrapper and WhatsApp clients silently drop the card.
   */
  async sendEvent(sock, jid, { name, description, startTime, minutesAhead, joinLink }, options = {}) {
    const calculatedStartTime = startTime
      ? (typeof startTime === 'string' ? parseInt(startTime, 10) : startTime)
      : Math.floor(Date.now() / 1000) + ((minutesAhead || 30) * 60);

    // FIX: Route through sock.sendMessage so the fork's handleEvent applies the
    // required viewOnceMessage + supportPayload wrapper. Relaying a flat eventMessage
    // directly via generateWAMessageFromContent skips this wrapper, causing WA clients
    // to silently drop or misrender the event card.
    return await sock.sendMessage(jid, {
      eventMessage: {
        isCanceled: false,
        name,
        description: description || 'Bot Dynamic Event',
        location: { degreesLatitude: 0, degreesLongitude: 0, name: 'Location' },
        joinLink: joinLink || '',
        startTime: calculatedStartTime,
        extraGuestsAllowed: true,
      }
    }, options);
  },

  /**
   * Sends an interactive Poll or a pre-populated Poll Result card
   */
  async sendPoll(sock, jid, { question, options, isResult, pollVotes }, optionsExtra = {}) {
    if (isResult) {
      // Send custom pollResultMessage supported by the fork
      return await sock.sendMessage(jid, {
        pollResultMessage: {
          name: question,
          pollVotes: pollVotes || []
        }
      }, optionsExtra);
    } else {
      // Send standard interactive poll message
      return await sock.sendMessage(jid, {
        poll: {
          name: question,
          values: options || [],
          selectableCount: 1
        }
      }, optionsExtra);
    }
  },

  /**
   * Sends a multi-card Carousel Message structure
   */
  /**
   * Sends a richResponseMessage wrapped in the Meta AI botForwardedMessage
   * envelope — required so WA clients render table/code bubbles with the bot badge.
   *
   * content shape (same keys as prepareRichResponseMessage):
   *   richResponse  → [{ text: '...' } | { code: tokenizedBlocks, language: '...' }]
   *   table         → { title: '...', rows: [{ items: string[] }] }
   *   footerText    → string
   *
   * The bot-metadata proof chain (certificate + signature) is generated inline —
   * we do NOT need to deep-import baileys/lib/Utils/rich-message-utils.js.
   *
   * Falls back to plain text if the proto relay fails (e.g. unsupported client).
   */
      async sendRichResponse(sock, jid, content, sendOptions = {}) {
    try {
      // The Baileys fork natively processes rich properties (e.g. code, links, table, items, etc.)
      // and converts them via prepareRichResponseMessage before relaying.
      return await sock.sendMessage(jid, content, sendOptions);
    } catch (err) {
      console.warn('[baileysBridge.sendRichResponse] relay failed, plain text fallback:', err.message);
      
      let fallbackText = '';
      if (content.headerText) fallbackText += "*" + content.headerText + "*\n\n";
      if (content.contentText) fallbackText += content.contentText + "\n\n";
      if (content.code) fallbackText += "```" + (content.language || '') + "\n" + content.code + "\n```\n\n";
      
      if (content.table && Array.isArray(content.table)) {
        fallbackText += content.table.map(r => r.join(' │ ')).join('\n') + '\n\n';
      }
      if (content.items && Array.isArray(content.items)) {
        fallbackText += content.items.map(i => "• " + i.title + "\n  " + i.text).join('\n\n') + '\n\n';
      }
      if (content.links && Array.isArray(content.links)) {
        fallbackText += content.links.map((l, i) => "[" + (i+1) + "] " + (l.title || 'Link') + ": " + l.url).join('\n') + '\n\n';
      }
      if (content.footerText) fallbackText += "_" + content.footerText + "_";
      
      return sock.sendMessage(jid, { text: fallbackText.trim() || 'Rich content unavailable' }, sendOptions);
    }
  },

  async sendCarousel(sock, jid, { text, footer, cards }, options = {}) {
    // FORK QUIRK (lib/Utils/messages.js): the carousel branch is selected via
    // `hasNonNullishProperty(message, 'cards')` — it checks for a *top-level*
    // `cards` array, not a nested `carousel.cards`. Wrapping cards in an outer
    // `carousel: { cards }` key (as this used to do) means the top-level
    // object has no `cards` property at all, so the carousel branch never
    // matches. The payload then falls through the rest of the if/else chain
    // and is ultimately relayed as a bare text message — which is exactly
    // the "carousel renders as plain text" symptom. `cards` (and `text`/
    // `footer`) must be flat, top-level keys.
    //
    // Card shape (fork handles per-card upload + proto assembly):
    //   { nativeFlow: [{ text, id|url|copy|call }], image: Buffer|{url}, caption: '...', footer: '...' }
    // Use `caption` (not `text`) for the body on image/media cards.
    return await sock.sendMessage(jid, {
      cards,
      text,
      ...(footer ? { footer } : {}),
    }, options);
  },

  async sendProduct(sock, jid, { title, description, productId, currency, price, footer, thumbnail, buttons } = {}, options = {}) {
    // correct viewOnceMessage > interactiveMessage structure. The old raw productMessage
    // proto (with nested .product) is the legacy business-catalog format — WA clients
    // render it only on verified business accounts and silently drop it on regular bots.
    return await sock.sendMessage(jid, {
      productMessage: {
        title: title || 'Premium Command Product',
        description: description || 'WhatsApp Bot Interactive Product Showcase',
        productId: productId || 'product-1',
        retailerId: productId || 'retailer-1',
        currencyCode: currency || 'USD',
        priceAmount1000: (price || 1) * 1000,
        footer: footer || '',
        thumbnail: thumbnail || undefined,
        buttons: buttons || [],
      }
    }, options);
  },

  /**
   * Performs newsletter manager operations using the fork's native newsletter functions
   */
  async sendNewsletter(sock, jid, { action, name, description }, options = {}) {
    if (typeof sock.newsletterCreate !== 'function') {
      throw new Error('Socket does not support newsletter operations');
    }

    if (action === 'create') {
      return await sock.newsletterCreate(name, description || '');
    } else if (action === 'info') {
      return await sock.newsletterMetadata('jid', jid);
    } else if (action === 'follow') {
      return await sock.newsletterFollow(jid);
    } else if (action === 'unfollow') {
      return await sock.newsletterUnfollow(jid);
    }
    throw new Error(`Unsupported newsletter action: ${action}`);
  },

  /**
   * Generate a v1 message ID (legacy format: 3EB0 + hex).
   * Use generateId() for new messages — it produces the newer v2 format.
   */
  generateId() {
    return generateMessageIDV2();
  },

  /**
   * Sends standard or custom media message payload
   */
  async sendMedia(sock, jid, { type, buffer, caption, mimetype, fileName, ptt }, options = {}) {
    const payload = {};
    if (type === 'image') {
      payload.image = buffer;
      payload.caption = caption;
    } else if (type === 'video') {
      payload.video = buffer;
      payload.caption = caption;
    } else if (type === 'audio') {
      payload.audio = buffer;
      payload.mimetype = mimetype || 'audio/mp4';
      payload.ptt = !!ptt;
    } else if (type === 'document') {
      payload.document = buffer;
      payload.mimetype = mimetype || 'application/octet-stream';
      payload.fileName = fileName || 'document';
      payload.caption = caption;
    } else if (type === 'sticker') {
      payload.sticker = buffer;
    } else {
      throw new Error(`Unsupported media type: ${type}`);
    }

    return await sock.sendMessage(jid, payload, options);
  }
};

export default baileysBridge;
