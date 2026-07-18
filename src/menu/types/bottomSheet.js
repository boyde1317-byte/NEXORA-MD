import { capabilities } from '../../core/capabilities.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';

/**
 * Bottom Sheet Menu (id: 13)
 *
 * IMPORTANT — "bottom sheet" is NOT a separate proto message type.
 * BottomSheetMessage does not exist in WAProto.proto. The sheet UX is triggered
 * by the `optionText` field on a standard nativeFlowMessage:
 *   • `optionText` present → WA renders a collapse button; tapping it opens a
 *     native modal sheet listing all quick_reply rows.
 *   • `optionText` absent  → WA renders the buttons inline (flat).
 *
 * Since the fork confirms `nativeFlowMessage` + `optionText` are both supported,
 * the gate here is `capabilities.nativeFlow` (not `capabilities.bottomSheet`
 * which is always false by design — it's not a proto type).
 *
 * Command rows are passed as quick_reply buttons ({ text, id }).
 * Top CTA / URL buttons are mixed in before the quick-reply rows so WA
 * clients show them inline in the message (not collapsed into the sheet).
 *
 * Image strategy:
 *   imgData.buffer (or URL fallback) is passed as `image:` on the Tier 1
 *   nativeFlow card so the panel renders with a full image header. The same
 *   image is embedded as an externalAdReply thumbnail on Tier 2 (flat flow),
 *   and surfaced via a separate imageMessage send before Tier 3 (plain text).
 *
 * Tiers:
 *   1 → nativeFlow with optionText + image header (triggers native WA bottom sheet)
 *   2 → nativeFlow without optionText + image header (flat quick-reply buttons)
 *   3 → guaranteed plain text
 */
export const bottomSheetMenu = {
  id: 13,
  name: 'bottomSheet',
  description: 'Bottom sheet modal — optionText on nativeFlow collapses rows into a native WA sheet',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData    = await imageManager.getMenuImage(13);
    const bodyText   = `⚡ *NEXORA MD BOTTOM SHEET PANEL*\n\n` + buildTextMenu(menuData);
    const footerText = footerManager.getFooter() || `${menuData.botName} • Interactive Panel`;

    // Resolve image payload: prefer the { url } form — WA fetches it directly,
    // no local buffer download/re-upload round trip. Buffer is only a fallback
    // for local disk images that have no public URL.
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Command rows exposed in the sheet.
    // Keep this list ≤ 10 — the fork's bottom_sheet config uses divider_indices
    // to match the number of nativeFlow buttons; too many can overflow the sheet.
    const commandButtons = [
      { text: 'Measure Ping Speed',        id: `${menuData.prefix}ping` },
      { text: 'About Nexora MD',           id: `${menuData.prefix}about` },
      { text: 'Version Check',             id: `${menuData.prefix}version` },
      { text: 'Switch Menu Style',         id: `${menuData.prefix}menulist` },
      { text: 'Set Footer Style',          id: `${menuData.prefix}setfooter` },
      { text: 'Debug Bottom Sheet',        id: `${menuData.prefix}testmessage bottomsheet` },
      { text: 'Debug Native Flow',         id: `${menuData.prefix}testmessage nativeflow` },
    ];

    // Inline CTA buttons (URL) placed first — they appear in the message body
    // before the sheet toggle button and are NOT collapsed into the sheet.
    const ctaButtons = [
      { text: '💬 Contact Developer', url: 'https://wa.me/233533416608' },
      { text: '📢 NEXORA Channel',    url: 'https://whatsapp.com/channel/0029Vb7eSHf42Dcmdd3XA326' },
    ];

    const allButtons = [...ctaButtons, ...commandButtons];

    // ── Tier 1: nativeFlow + optionText + image header ────────────────────
    // Gate: capabilities.nativeFlow (true). `optionText` is a field on
    // nativeFlowMessage — no separate capability gate needed.
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:        bodyText,
          footer:      footerText,
          image:       imagePayload,
          buttons:     allButtons,
          optionText:  '📋 Browse All Commands',
          optionTitle: 'NEXORA MD PANEL',
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 1 (nativeFlow + optionText + image) failed, trying flat nativeFlow:', err.message);
      }
    }

    // ── Tier 2: nativeFlow without optionText + image header ──────────────
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendNativeFlow(sock, m.from, {
          text:    bodyText,
          footer:  footerText,
          image:   imagePayload,
          buttons: allButtons.slice(0, 5),
        }, { quoted: menuData.audioQuote || m });
      } catch (err) {
        console.warn('[MENU bottomSheet] Tier 2 (flat nativeFlow + image) failed, escalating to text:', err.message);
        throw err; // propagate → runWithFallback → plain text
      }
    }

    // ── Tier 3: nativeFlow unsupported — let runWithFallback render plain text
    throw new Error('bottomSheet: nativeFlow unsupported on this client');
  },
};

export default bottomSheetMenu;
