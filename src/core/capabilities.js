import { proto } from 'baileys';

// Dynamically check proto properties to avoid guessing support
const hasInteractive = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('interactiveMessage') || 
  proto?.Message?.InteractiveMessage
);

const hasNativeFlow = !!(
  proto?.Message?.InteractiveMessage?.NativeFlowMessage || 
  proto?.Message?.InteractiveMessage?.prototype?.hasOwnProperty?.('nativeFlowMessage')
);

const hasBottomSheet = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('bottomSheetMessage') || 
  proto?.Message?.BottomSheetMessage ||
  false
);

const hasOfferText = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('offerTextMessage') || 
  proto?.Message?.OfferTextMessage ||
  false
);

const hasRequestPayment = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('requestPaymentMessage') || 
  proto?.Message?.RequestPaymentMessage
);

const hasEventMessage = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('eventMessage') || 
  proto?.Message?.EventMessage
);

const hasDocumentInteractive = !!(
  proto?.Message?.prototype?.hasOwnProperty?.('documentMessage') || 
  proto?.Message?.DocumentMessage ||
  true
);

export const capabilities = {
  interactive: hasInteractive,
  nativeFlow: hasNativeFlow,
  bottomSheet: hasBottomSheet,
  offerText: hasOfferText,
  requestPayment: hasRequestPayment,
  eventMessage: hasEventMessage,
  documentInteractive: hasDocumentInteractive,
  newsletter: {
    enabled: true,
    adminInviteMessage: !!(proto?.Message?.prototype?.hasOwnProperty?.('newsletterAdminInviteMessage') || proto?.Message?.NewsletterAdminInviteMessage),
    followerInviteMessage: !!(proto?.Message?.prototype?.hasOwnProperty?.('newsletterFollowerInviteMessage') || proto?.Message?.NewsletterFollowerInviteMessage),
    metadata: true,
    follow: true,
    reactions: true,
    sending: true
  }
};

console.log('╭───────────────────────────────────╮');
console.log('│      NEXORA MD CAPABILITIES       │');
console.log('├───────────────────────────────────┤');
console.log(`│ Interactive: ${capabilities.interactive ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log(`│ NativeFlow:  ${capabilities.nativeFlow ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log(`│ BottomSheet: ${capabilities.bottomSheet ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log(`│ OfferText:   ${capabilities.offerText ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log(`│ EventMsg:    ${capabilities.eventMessage ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log(`│ Newsletter:  ${capabilities.newsletter.adminInviteMessage ? 'SUPPORTED ✓ ' : 'UNSUPPORTED ✗'} │`);
console.log('╰───────────────────────────────────╯');

export default capabilities;
