import { proto } from 'baileys';

// ─── Static verdicts derived from WAProto/WAProto.proto + WAProto/index.d.ts ─
//
// WHY static verdicts:
//   proto.Message.X nested type checks via protobufjs always return undefined
//   even when the type IS compiled into WAProto. Nested message constructors
//   are not exposed as direct properties; they live inside the namespace object
//   and cannot be reliably detected at runtime. Static verdicts are set once
//   after auditing WAProto.proto directly and are only updated when the baileys
//   fork is upgraded.
//
// FORK: github:boyde1317-byte/baileys#472c9252ba77b4eb31e3ca15784746e1d9de3c14
// BASE: itsliaaa/Baileys 0.3.18-final
// LAST AUDITED: 2026-07-15

// Confirmed PRESENT in WAProto.proto:
const hasInteractive  = true;   // Message.InteractiveMessage
const hasNativeFlow   = true;   // Message.InteractiveMessage.NativeFlowMessage
const hasDocInteract  = true;   // Message.DocumentMessage (always present)
const hasAlbum        = true;   // albumMessage — fork's multi-image/video carousel
const hasStickerPack  = true;   // stickerPackMessage
const hasLottieStick  = true;   // lottieStickerMessage
const hasQuizPoll     = true;   // pollCreationMessage.isQuiz
// richResponseMessage/botForwardedMessage requires a real Meta AI-bot
// verification certificate (signed by Meta) inside messageContextInfo.botMetadata.
// baileysBridge._buildBotForwardedMessage fabricates that cert with random
// bytes because there is no way to obtain a genuine one — WhatsApp clients
// reject the forged signature and fall back to the "your version of
// WhatsApp doesn't support it" placeholder (see .wiki / .search / .code).
// This is not fixable without a real Meta certificate, so the capability
// is reported as unsupported and callers (richTableCard/richCodeCard) skip
// straight to their reliable ASCII/plain-text fallback paths instead.
const hasRichResp     = false;  // richResponseMessage / botForwardedMessage — forged cert, unrenderable
const hasSpoiler      = true;   // spoilerMessage
const hasGroupStatus  = true;   // groupStatusMessageV2

// Confirmed ABSENT from WAProto.proto (not a proto message type):
//   BottomSheetMessage — does not exist.
//   NOTE: The "bottom sheet" UX is triggered by the `optionText` field inside a
//   standard NativeFlowMessage, NOT by a dedicated proto type. Since nativeFlow
//   is supported, optionText IS supported — but it is a field, not a message type.
const hasBottomSheet  = false;  // BottomSheetMessage — NOT in WAProto.proto
const hasOptionText   = true;   // optionText field ON nativeFlowMessage — IS supported
const hasOfferText    = false;  // OfferTextMessage — NOT in WAProto.proto (offerText IS a nativeFlow field)

// Proto-introspectable types (simple top-level check — reliable for non-nested):
// Note: nested types (RequestPaymentMessage, EventMessage) are still unreliable via
// proto.Message.X.Y — fall back to hardcoded true since fork audited as supporting them.
const hasRequestPayment = true; // requestPaymentMessage — confirmed in fork
const hasEventMessage   = true; // eventMessage — confirmed in WAProto.proto

export const capabilities = {
  // ── Core interactive / button system ─────────────────────────────────────
  interactive:          hasInteractive,
  nativeFlow:           hasNativeFlow,
  documentInteractive:  hasDocInteract,

  // ── Bottom sheet / offer text ─────────────────────────────────────────────
  // bottomSheet: false — BottomSheetMessage is NOT a proto type.
  //   Use `optionText: true` to gate the sheet UX trigger.
  bottomSheet:          hasBottomSheet,
  optionText:           hasOptionText,   // nativeFlow `optionText` field — triggers sheet UI
  offerText:            hasOfferText,    // nativeFlow `offerText` field — offer banner (field, not type)

  // ── Extended message types ────────────────────────────────────────────────
  requestPayment:       hasRequestPayment,
  eventMessage:         hasEventMessage,

  // ── Album / carousel ─────────────────────────────────────────────────────
  // carousel is NOT a standalone proto type — the fork routes it through
  // interactiveMessage.CarouselMessage via { carousel: { cards } } in sendMessage.
  album:                hasAlbum,

  // ── Sticker / media ───────────────────────────────────────────────────────
  stickerPack:          hasStickerPack,
  lottieSticker:        hasLottieStick,

  // ── Polls / quiz ─────────────────────────────────────────────────────────
  quizPoll:             hasQuizPoll,

  // ── Rich response / AI badge ─────────────────────────────────────────────
  richResponse:         hasRichResp,

  // ── Spoiler / group status ───────────────────────────────────────────────
  spoilerMessage:       hasSpoiler,
  groupStatus:          hasGroupStatus,

  // ── Newsletter ────────────────────────────────────────────────────────────
  // adminInviteMessage / followerInviteMessage are NESTED proto types — cannot
  // be detected via proto.Message.X introspection (protobufjs limitation).
  // Runtime detection (socket method presence) is done in baileysScanner.js.
  // We keep `enabled: true` here as the static baseline; scanner gates actual sends.
  newsletter: {
    enabled:                true,
    subscribed:             true,
    // These two are always false from proto introspection — use scanner instead.
    adminInviteMessage:     false,
    followerInviteMessage:  false,
    metadata:               true,
    follow:                 true,
    reactions:              true,
    sending:                true,
  },
};

// ── Startup capability report ─────────────────────────────────────────────────
console.log('╭───────────────────────────────────────╮');
console.log('│        NEXORA MD CAPABILITIES          │');
console.log('├───────────────────────────────────────┤');
console.log(`│ Interactive : ${capabilities.interactive      ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ NativeFlow  : ${capabilities.nativeFlow       ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ OptionText  : ${capabilities.optionText       ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ Album       : ${capabilities.album            ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ StickerPack : ${capabilities.stickerPack      ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ Lottie      : ${capabilities.lottieSticker    ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ RichResp    : ${capabilities.richResponse     ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ EventMsg    : ${capabilities.eventMessage     ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ Newsletter  : ${capabilities.newsletter.enabled ? '✓ SUPPORTED   ' : '✗ UNSUPPORTED '}        │`);
console.log(`│ BottomSheet : ${capabilities.bottomSheet      ? '✓ SUPPORTED   ' : '✗ PROTO N/A   '}        │`);
console.log(`│ OfferText   : ${capabilities.optionText       ? '✓ FIELD ONLY  ' : '✗ UNSUPPORTED '}        │`);
console.log('╰───────────────────────────────────────╯');

export default capabilities;
