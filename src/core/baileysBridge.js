import { generateWAMessageFromContent, generateWAMessage, generateMessageID, generateMessageIDV2, proto } from 'baileys';
import { randomBytes } from 'node:crypto';

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
   * Sends a premium rich interactive card combining media headers, nativeFlow buttons,
   * embedded externalAdReply banners, business forward info, and Meta AI badge support.
   *
   * @param {object} sock                             Baileys socket connection
   * @param {string} jid                              Recipient JID
   * @param {object} card                             Card configuration object
   * @param {string} card.body                        Main card body text
   * @param {string} [card.footer]                    Card footer text
   * @param {string} [card.title]                     Header title
   * @param {string} [card.subtitle]                  Header subtitle
   * @param {*}      [card.image]                     Header image (Buffer, {url}, stream, or imageMessage proto)
   * @param {*}      [card.video]                     Header video (Buffer, {url}, stream, or videoMessage proto)
   * @param {Array}  [card.buttons]                   nativeFlow buttons [{name, params}, {text, id}, etc.]
   * @param {object} [card.contextInfo]               ContextInfo placed inside interactiveMessage
   * @param {object} [card.adReply]                   External ad reply configuration object
   * @param {string} [card.adReply.title]             Ad reply title
   * @param {string} [card.adReply.body]              Ad reply body
   * @param {string} [card.adReply.sourceUrl]         Ad reply source URL
   * @param {number} [card.adReply.mediaType]         Ad reply media type (default: 1)
   * @param {boolean}[card.adReply.renderLargerThumbnail] Render larger thumbnail flag
   * @param {*}      [card.adReply.thumbnail]         Ad reply thumbnail buffer
   * @param {string} [card.adReply.thumbnailUrl]      Ad reply thumbnail URL
   * @param {boolean}[card.adReply.showAdAttribution] Show ad attribution badge
   * @param {string} [card.adReply.originalImageUrl] High-res original image URL
   * @param {string} [card.businessOwnerJid]          Owner JID for businessMessageForwardInfo
   * @param {boolean}[card.aiMessage]                 Attach Meta AI supportPayload badge
   * @param {object} [options]                        sendMessage/relayMessage options
   * @returns {Promise<object>}                       Relayed WAMessage object
   */
  async sendRichCard(
    sock,
    jid,
    {
      body,
      footer,
      title,
      subtitle,
      image,
      video,
      buttons,
      contextInfo,
      adReply,
      businessOwnerJid,
      aiMessage,
    } = {},
    options = {}
  ) {
    // ── Header media upload ───────────────────────────────────────────────
    let headerImageMessage;
    if (image) {
      headerImageMessage = await this._uploadImageMessage(sock, jid, image, options);
    }

    let headerVideoMessage;
    if (video) {
      headerVideoMessage = await this._uploadVideoMessage(sock, jid, video, options);
    }

    // ── interactiveMessage.contextInfo ───────────────────────────────────
    const effectiveBusinessOwnerJid = businessOwnerJid || options.businessOwnerJid;
    let interactiveContextInfo;

    if (contextInfo || adReply || effectiveBusinessOwnerJid) {
      interactiveContextInfo = { ...(contextInfo || {}) };

      if (adReply) {
        const externalAdReply = {
          title:                 adReply.title ?? '',
          body:                  adReply.body ?? '',
          sourceUrl:             adReply.sourceUrl ?? '',
          mediaType:             adReply.mediaType ?? 1,
          renderLargerThumbnail: adReply.renderLargerThumbnail ?? false,
          showAdAttribution:     adReply.showAdAttribution ?? false,
          ...adReply,
        };
        if (adReply.thumbnail !== undefined) externalAdReply.thumbnail = adReply.thumbnail;
        if (adReply.thumbnailUrl !== undefined) externalAdReply.thumbnailUrl = adReply.thumbnailUrl;
        if (adReply.originalImageUrl !== undefined) externalAdReply.originalImageUrl = adReply.originalImageUrl;

        interactiveContextInfo.externalAdReply = externalAdReply;
      }

      if (effectiveBusinessOwnerJid && !interactiveContextInfo.businessMessageForwardInfo) {
        interactiveContextInfo.businessMessageForwardInfo = {
          businessOwnerJid: effectiveBusinessOwnerJid,
        };
      }
    }

    // ── Header construction ──────────────────────────────────────────────
    const hasHeader =
      title !== undefined ||
      subtitle !== undefined ||
      headerImageMessage !== undefined ||
      headerVideoMessage !== undefined;

    const header = hasHeader
      ? {
          title: title || '',
          subtitle: subtitle || '',
          hasMediaAttachment: !!(headerImageMessage || headerVideoMessage),
          ...(headerImageMessage ? { imageMessage: headerImageMessage } : {}),
          ...(headerVideoMessage ? { videoMessage: headerVideoMessage } : {}),
        }
      : undefined;

    // ── interactiveMessage payload ───────────────────────────────────────
    const msgContent = {
      interactiveMessage: {
        body: { text: body || '' },
        footer: { text: footer || '' },
        ...(header ? { header } : {}),
        nativeFlowMessage:
          buttons && buttons.length > 0
            ? {
                buttons: buttons.map((btn) => {
                  let name = btn.name;
                  if (!name) {
                    if (btn.url) name = 'cta_url';
                    else if (btn.copy) name = 'cta_copy';
                    else if (btn.call) name = 'cta_call';
                    else name = 'quick_reply';
                  }

                  let buttonParamsJson = btn.buttonParamsJson;
                  if (!buttonParamsJson) {
                    if (typeof btn.params === 'string') {
                      buttonParamsJson = btn.params;
                    } else if (btn.params && typeof btn.params === 'object') {
                      buttonParamsJson = JSON.stringify(btn.params);
                    } else if (btn.id !== undefined) {
                      buttonParamsJson = JSON.stringify({
                        display_text: btn.text || btn.label || '',
                        id: btn.id,
                      });
                    } else if (btn.url !== undefined) {
                      buttonParamsJson = JSON.stringify({
                        display_text: btn.text || btn.label || '',
                        url: btn.url,
                      });
                    } else if (btn.copy !== undefined) {
                      buttonParamsJson = JSON.stringify({
                        display_text: btn.text || btn.label || '',
                        copy_code: btn.copy,
                      });
                    } else if (btn.call !== undefined) {
                      buttonParamsJson = JSON.stringify({
                        display_text: btn.text || btn.label || '',
                        phone_number: btn.call,
                      });
                    } else {
                      buttonParamsJson = JSON.stringify({});
                    }
                  }

                  return {
                    name,
                    buttonParamsJson,
                  };
                }),
              }
            : undefined,
        ...(interactiveContextInfo ? { contextInfo: interactiveContextInfo } : {}),
      },
    };

    const effectiveAiMessage = aiMessage ?? options.aiMessage;
    const relayOptions = {
      ...options,
      ...(effectiveAiMessage !== undefined ? { aiMessage: effectiveAiMessage } : {}),
    };

    return await this.relayMessage(sock, jid, msgContent, relayOptions);
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
    //
    // FORK LIMITATION: when no media is attached, `title` is passed but the
    // fork ignores it — the `text` branch sets `body = { text }` and never
    // enters the header branch, so `title` has no effect. The title only
    // renders when `caption` is used (media path). Callers that need a title
    // without media should embed it in the `text` body instead.
    const hasMedia = !!(image || video);
    return await sock.sendMessage(jid, {
      nativeFlow: buttons,
      ...(hasMedia ? { caption: text, title: title || '' } : { text }),
      footer,
      // title without media is silently dropped by the fork — don't pass it
      // to avoid implying it will render. Callers should fold it into `text`.
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
    // FORK DISPATCH: The fork's generateWAMessageContent dispatches events via
    // `hasNonNullishProperty(message, 'event')` — NOT 'eventMessage'. Passing
    // { eventMessage: {...} } silently falls through to the text branch.
    // The fork also calls `message.event.startDate.getTime()` so startDate
    // must be a Date object, not a unix timestamp number/string.
    const startSeconds = startTime
      ? (typeof startTime === 'string' ? parseInt(startTime, 10) : startTime)
      : Math.floor(Date.now() / 1000) + ((minutesAhead || 30) * 60);

    return await sock.sendMessage(jid, {
      event: {
        name,
        description: description || 'Bot Dynamic Event',
        startDate: new Date(startSeconds * 1000),
        location: { degreesLatitude: 0, degreesLongitude: 0, name: 'Location' },
        // joinLink is set by the fork when event.call + getCallLink are provided;
        // for manual join links we pass it directly in the location field.
        ...(joinLink ? { joinLink } : {}),
        extraGuestsAllowed: true,
        isCancelled: false,
      }
    }, options);
  },

  /**
   * Sends an interactive Poll or a pre-populated Poll Result card
   */
  async sendPoll(sock, jid, { question, options, isResult, pollVotes, pollType }, optionsExtra = {}) {
    if (isResult) {
      // FORK DISPATCH: fork expects { pollResult: { name, votes, pollType } }
      // NOT { pollResultMessage: { name, pollVotes } }. The fork maps
      // pollResult.votes → [{ optionName: vote.name, optionVoteCount: vote.voteCount }]
      // and pollResult.pollType (1=quiz, 0=poll) to the correct snapshot version.
      return await sock.sendMessage(jid, {
        pollResult: {
          name: question,
          votes: (pollVotes || []).map(v => ({
            name: v.name || v.optionName || '',
            voteCount: v.voteCount || v.optionVoteCount || 0,
          })),
          pollType: pollType || 0,
        }
      }, optionsExtra);
    } else {
      // Send standard interactive poll message — fork matches on 'poll' key
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
      
      // Handle richResponse array (wrapped submessages)
      if (Array.isArray(content.richResponse)) {
        for (const sub of content.richResponse) {
          if (sub.text) fallbackText += sub.text + "\n\n";
          else if (sub.code) fallbackText += "```" + (sub.language || '') + "\n" + (Array.isArray(sub.code) ? sub.code.map(b => b.codeContent).join('') : sub.code) + "\n```\n\n";
          else if (sub.table && Array.isArray(sub.table)) {
            fallbackText += (sub.title ? `*${sub.title}*\n` : '');
            fallbackText += sub.table.map(r => (r.items || r).join(' │ ')).join('\n') + '\n\n';
          }
          else if (sub.items && Array.isArray(sub.items)) {
            fallbackText += sub.items.map(i => "• " + (i.title || '') + (i.text ? "\n  " + i.text : '')).join('\n\n') + '\n\n';
          }
          else if (sub.inlineImage) {
            fallbackText += `[🖼️ ${sub.imageText || 'Image'}: ${sub.inlineImage}]\n\n`;
          }
        }
      }
      
      // Handle flat (non-array) content
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

  async sendProduct(sock, jid, { title, description, productId, currency, price, footer, thumbnail, businessOwnerJid } = {}, options = {}) {
    // FORK DISPATCH: fork dispatches via `hasNonNullishProperty(message, 'product')`
    // NOT 'productMessage'. prepareProductMessage requires businessOwnerJid and
    // wraps the product data inside message.product. Passing productMessage directly
    // silently falls through to the text branch.
    return await sock.sendMessage(jid, {
      businessOwnerJid: businessOwnerJid || (sock.user?.id || '0@s.whatsapp.net'),
      product: {
        title: title || 'Premium Command Product',
        description: description || 'WhatsApp Bot Interactive Product Showcase',
        productId: productId || 'product-1',
        retailerId: productId || 'retailer-1',
        currencyCode: currency || 'USD',
        priceAmount1000: (price || 1) * 1000,
        footer: footer || '',
        ...(thumbnail ? { productImage: thumbnail } : {}),
      },
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
