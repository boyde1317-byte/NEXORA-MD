export const messageCapability = {
  // Product cards (.product, greeting style 5) — image + title + price, no
  // inline mention markup, so the greeting also carries `mentions`.
  productMessage: {
    caption: false,
    thumbnail: true,
    mentions: true,
    externalAdReply: false,
    interactiveHeaders: false
  },

  imageMessage: {
    caption: true,
    thumbnail: true,
    mentions: true,
    externalAdReply: true,
    interactiveHeaders: true
  },

  audioMessage: {
    caption: false,
    thumbnail: false,
    mentions: false,
    externalAdReply: false,
    interactiveHeaders: false
  },

  documentMessage: {
    caption: true,
    thumbnail: true,
    mentions: true,
    externalAdReply: true,
    interactiveHeaders: false
  },

  interactiveMessage: {
    headerImage: true,
    buttons: true,
    caption: true,
    mentions: true,
    externalAdReply: false,
    interactiveHeaders: true
  },

  extendedTextMessage: {
    caption: true,
    thumbnail: true,
    mentions: true,
    externalAdReply: true,
    interactiveHeaders: false
  }
};

export default messageCapability;
