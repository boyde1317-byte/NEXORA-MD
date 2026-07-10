import { generateWAMessageFromContent, generateWAMessage, generateMessageID, proto } from 'baileys';
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
    // Legacy/explicit viewOnceMessage still gets its secret (real view-once sends).
    if (messageContent.viewOnceMessage?.message) {
      const inner = messageContent.viewOnceMessage.message;
      if (!inner.messageContextInfo) {
        inner.messageContextInfo = {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: randomBytes(32),
        };
      }
    } else {
      // Flat (non-view-once) payload: inject messageSecret at the top level
      // for the types that require it, without any viewOnceMessage wrapper.
      const SECRET_REQUIRED_KEYS = [
        'eventMessage',
        'productMessage',
        'interactiveMessage',
        'pollCreationMessage',
        'pollCreationMessageV2',
        'pollCreationMessageV3',
      ];
      const hasSecretRequiredType = SECRET_REQUIRED_KEYS.some(key => key in messageContent);
      if (hasSecretRequiredType && !messageContent.messageContextInfo) {
        messageContent.messageContextInfo = {
          messageSecret: randomBytes(32),
        };
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
   * Sends a premium Interactive Message (standard or custom)
   */
  async sendInteractive(sock, jid, { body, footer, header, buttons }, options = {}) {
    let headerImageMessage = header?.imageMessage;
    if (!headerImageMessage && header?.image) {
      headerImageMessage = await this._uploadImageMessage(sock, jid, header.image, options);
    }

    const msgContent = {
      interactiveMessage: {
        body: { text: body },
        footer: { text: footer || '' },
        header: header ? {
          title: header.title || '',
          subtitle: header.subtitle || '',
          hasMediaAttachment: !!header.hasMediaAttachment,
          ...(header.documentMessage ? { documentMessage: header.documentMessage } : {}),
          ...(headerImageMessage ? { imageMessage: headerImageMessage } : {})
        } : undefined,
        nativeFlowMessage: buttons ? {
          buttons: buttons.map(btn => ({
            name: btn.name || 'quick_reply',
            buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params || {})
          }))
        } : undefined
      }
    };

    return await this.relayMessage(sock, jid, msgContent, options);
  },

  /**
   * Sends an advanced Native Flow interactive message with quick replies, buttons, urls
   */
  async sendNativeFlow(sock, jid, { text, footer, title, buttons }, options = {}) {
    return await this.sendInteractive(sock, jid, {
      body: text,
      footer: footer,
      header: title ? { title, hasMediaAttachment: false } : undefined,
      buttons: buttons
    }, options);
  },

  /**
   * Sends a Request Payment message using the fork's native capability
   */
  async sendPayment(sock, jid, { amount, currency, note, expiry, background }, options = {}) {
    // The fork natively handles requestPaymentMessage inside sendMessage
    return await sock.sendMessage(jid, {
      requestPaymentMessage: {
        amount: amount || 10000, // standard smallest unit * 1000
        currency: currency || 'USD',
        note: note || 'AI Bot Premium Menu Invoice',
        expiry: expiry || Math.floor(Date.now() / 1000) + 86400,
        background: background
      }
    }, options);
  },

  /**
   * Sends a custom Event Invitation card.
   * Built directly as a viewOnceMessage so it benefits from the central
   * messageSecret injection in relayMessage — avoids the unreliable
   * sock.sendMessage → extended-handler route.
   */
  async sendEvent(sock, jid, { name, description, startTime, minutesAhead, joinLink }, options = {}) {
    const calculatedStartTime = startTime
      ? (typeof startTime === 'string' ? parseInt(startTime, 10) : startTime)
      : Math.floor(Date.now() / 1000) + ((minutesAhead || 30) * 60);

    const msgContent = {
      eventMessage: {
        isCanceled: false,
        name,
        description: description || 'Bot Dynamic Event',
        location: { degreesLatitude: 0, degreesLongitude: 0, name: 'Location' },
        joinLink: joinLink || '',
        startTime: calculatedStartTime,
        extraGuestsAllowed: true,
      }
    };

    return await this.relayMessage(sock, jid, msgContent, options);
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
  async sendCarousel(sock, jid, { text, cards }, options = {}) {
    // Construct carousel interactive cards structure if supported
    // If not, our outer menu fallback system will catch and convert to text
    // Carousel cards use `buttons` directly on each card — NOT wrapped in nativeFlowMessage.
    // nativeFlowMessage belongs on the outer interactiveMessage, not on individual cards.
    // Each card.image is a raw payload (buffer/url) and must be uploaded to WhatsApp's
    // media servers first — embedding it directly as `imageMessage` produces an invalid
    // proto (hasMediaAttachment:true with no real media behind it) and the image never renders.
    const cardsContent = await Promise.all((cards || []).map(async card => {
      const imageMessage = card.image
        ? await this._uploadImageMessage(sock, jid, card.image, options)
        : undefined;

      return {
        header: imageMessage ? {
          imageMessage,
          hasMediaAttachment: true
        } : undefined,
        body: { text: card.body || '' },
        footer: card.footer ? { text: card.footer } : undefined,
        buttons: (card.buttons || []).map(btn => ({
          name: btn.name || 'quick_reply',
          buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params || {})
        }))
      };
    }));

    const msgContent = {
      interactiveMessage: {
        body: { text: text || 'Select from the carousel:' },
        carouselMessage: {
          cards: cardsContent
        }
      }
    };

    return await this.relayMessage(sock, jid, msgContent, options);
  },

  /**
   * Sends a Product / Shop showcase item
   */
  async sendProduct(sock, jid, { productId, title, description, currency, price, footer }, options = {}) {
    const payload = {
      productMessage: {
        product: {
          productId: productId || 'product-1',
          title: title || 'Premium Command Product',
          description: description || 'WhatsApp Bot Interactive Product Showcase',
          currencyCode: currency || 'USD',
          priceAmount1000: String((price || 1) * 1000),
          retailerId: productId || 'retailer-1',
          productImageCount: 1
        },
        businessOwnerJid: sock.user?.id || '0@s.whatsapp.net'
      }
    };

    return await this.relayMessage(sock, jid, payload, options);
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
