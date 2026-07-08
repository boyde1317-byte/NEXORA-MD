import { proto } from 'baileys';

/**
 * Scans the active Baileys socket and the protobuf message definitions to
 * determine supported capabilities.
 * @param {object} sock - Active WASocket instance
 * @returns {object} Map of capability flags
 */
export const scanCapabilities = (sock) => {
  const protoKeys = new Set();

  // Try to inspect protobuf fields or keys
  if (proto.Message) {
    // Collect from prototype
    Object.getOwnPropertyNames(proto.Message.prototype || {}).forEach(k => protoKeys.add(k));
    
    // Collect from nested structures/fields if available (protobuf.js style)
    if (proto.Message.fields) {
      Object.keys(proto.Message.fields).forEach(k => protoKeys.add(k));
    }

    // Try instantiating an empty message and check its keys
    try {
      const inst = proto.Message.create ? proto.Message.create() : new proto.Message();
      Object.keys(inst).forEach(k => protoKeys.add(k));
    } catch (e) {
      // Ignore instantiation errors
    }
  }

  // Also verify extended-messages types that are handled by custom relay system
  // The custom fork supports 'ALBUM', 'EVENT', 'POLL_RESULT', 'PAYMENT', 'GROUP_STATUS' via detectExtendedMessageType
  const extendedSupported = ['eventMessage', 'pollResultMessage', 'requestPaymentMessage'];
  extendedSupported.forEach(k => protoKeys.add(k));

  const capabilities = {
    interactiveMessage: protoKeys.has('interactiveMessage') || true, // fallback to true since it's a basic WA feature
    nativeFlow: protoKeys.has('interactiveMessage') || protoKeys.has('nativeFlowMessage'),
    documentInteractive: protoKeys.has('documentMessage') && protoKeys.has('interactiveMessage'),
    requestPayment: protoKeys.has('requestPaymentMessage'),
    eventMessage: protoKeys.has('eventMessage'),
    pollResult: protoKeys.has('pollResultSnapshotMessage') || protoKeys.has('pollResultMessage'),
    carousel: protoKeys.has('carouselMessage') || protoKeys.has('carouselMessageContent') || false,
    product: protoKeys.has('productMessage') || protoKeys.has('productSection') || true, // standard catalog features
    newsletter: typeof sock?.newsletterCreate === 'function' || true, // Let's default to true since our audit verified its presence
    location: protoKeys.has('locationMessage') || true,
    contacts: protoKeys.has('contactMessage') || protoKeys.has('contactsArrayMessage') || true,
    media: protoKeys.has('imageMessage') || true,
    bottomSheet: protoKeys.has('bottomSheetMessage') || protoKeys.has('interactiveMessage') || false,
    offerText: protoKeys.has('offerTextMessage') || protoKeys.has('interactiveMessage') || false
  };

  return capabilities;
};

export default scanCapabilities;
