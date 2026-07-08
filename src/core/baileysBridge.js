import { generateWAMessageFromContent, generateMessageID, proto } from 'baileys';
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
   * Relays a fully formed proto.IMessage payload directly to WhatsApp servers
   */
  async relayMessage(sock, jid, messageContent, options = {}) {
    const msgId = options.messageId || generateMessageID();
    const message = await generateWAMessageFromContent(jid, messageContent, {
      userJid: sock.user?.id || '0@s.whatsapp.net',
      quoted: options.quoted,
    });
    
    await sock.relayMessage(jid, message.message, { messageId: message.key.id, ...options });
    return message;
  },

  /**
   * Sends a premium Interactive Message (standard or custom)
   */
  async sendInteractive(sock, jid, { body, footer, header, buttons }, options = {}) {
    const msgContent = {
      interactiveMessage: {
        body: { text: body },
        footer: { text: footer || '' },
        header: header ? {
          title: header.title || '',
          subtitle: header.subtitle || '',
          hasMediaAttachment: !!header.hasMediaAttachment,
          ...(header.documentMessage ? { documentMessage: header.documentMessage } : {}),
          ...(header.imageMessage ? { imageMessage: header.imageMessage } : {})
        } : undefined,
        nativeFlowMessage: buttons ? {
          buttons: buttons.map(btn => ({
            name: btn.name || 'quick_reply',
            buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params || {})
          }))
        } : undefined
      }
    };

    return await this.relayMessage(sock, jid, { viewOnceMessage: { message: msgContent } }, options);
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
   * Sends a custom Event Invitation card using the fork's native capability
   */
  async sendEvent(sock, jid, { name, description, startTime, minutesAhead, joinLink }, options = {}) {
    const calculatedStartTime = startTime || Math.floor(Date.now() / 1000) + ((minutesAhead || 30) * 60);
    return await sock.sendMessage(jid, {
      eventMessage: {
        name,
        description: description || 'Bot Dynamic Event',
        startTime: String(calculatedStartTime),
        joinLink: joinLink || 'https://call.whatsapp.com/video/ai-studio'
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
  async sendCarousel(sock, jid, { text, cards }, options = {}) {
    // Construct carousel interactive cards structure if supported
    // If not, our outer menu fallback system will catch and convert to text
    // Carousel cards use `buttons` directly on each card — NOT wrapped in nativeFlowMessage.
    // nativeFlowMessage belongs on the outer interactiveMessage, not on individual cards.
    const cardsContent = (cards || []).map(card => ({
      header: card.image ? {
        imageMessage: card.image,
        hasMediaAttachment: true
      } : undefined,
      body: { text: card.body || '' },
      footer: card.footer ? { text: card.footer } : undefined,
      buttons: (card.buttons || []).map(btn => ({
        name: btn.name || 'quick_reply',
        buttonParamsJson: typeof btn.params === 'string' ? btn.params : JSON.stringify(btn.params || {})
      }))
    }));

    const msgContent = {
      interactiveMessage: {
        body: { text: text || 'Select from the carousel:' },
        carouselMessage: {
          cards: cardsContent
        }
      }
    };

    return await this.relayMessage(sock, jid, { viewOnceMessage: { message: msgContent } }, options);
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

    return await this.relayMessage(sock, jid, { viewOnceMessage: { message: payload } }, options);
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
