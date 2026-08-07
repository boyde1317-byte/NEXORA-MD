import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { toSmallcaps } from '../../lib/smallcaps.js';
import { buildFakeImageQuote, buildFakePaymentQuote } from '../../lib/waUtils.js';
import { buildPillButton, buildPillUrlButton, buildPillCopyButton, buildNavigationButton } from './buttonsCard.js';

/**
 * Payment Menu (id: 2)
 *
 * Uses sendButtonsCard (buttonsMessage proto) as Tier 1 for universal
 * WhatsApp client compatibility. A fake requestPaymentMessage quote is
 * used for the reply bar visual (business invoice card). The native
 * requestPaymentMessage is retained as Tier 2.
 *
 * IMPORTANT: requestPaymentMessage only renders on verified business
 * accounts with payments enabled. On personal accounts it silently
 * no-ops. This is why sendButtonsCard is Tier 1.
 *
 * Tiers:
 *   1 → sendButtonsCard with image header + payment quote + adReply
 *   2 → requestPaymentMessage (business accounts only)
 *   3 → Guaranteed plain text
 */
export const paymentMenu = {
  id: 2,
  name: 'payment',
  description: 'Invoice-style pill-button card with payment quote + optional native payment fallback',
  supportedMessages: ['interactiveMessage', 'buttonsMessage', 'requestPaymentMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const imgData     = await imageManager.getMenuImage(2);
    const noteContent = `\u2726 *${toSmallcaps(menuData.botName)}* \u2726\n\n` + buildTextMenu(menuData);
    const footerText  = `${menuData.botName} \u2502 ${toSmallcaps('Payment Menu')}`;

    // Resolve image payload
    const imagePayload = imgData.source?.startsWith('http')
      ? { url: imgData.source }
      : (imgData.buffer || undefined);

    // Build fake payment quote for reply bar
    const paymentQuote = buildFakePaymentQuote({
      currencyCode:  'USD',
      amount1000:    45000,
      note:          `${menuData.botName} \u2502 ${menuData.totalCommands} commands`,
      expiryTimestamp: Date.now() + 86400 * 1000,
    });

    // Build embedded externalAdReply
    const adReply = {
      title:                 `\u2726 ${toSmallcaps(menuData.botName)} \u2726`,
      body:                  `${menuData.totalCommands} ${toSmallcaps('commands')} \u2502 ${toSmallcaps('Invoice')}`,
      sourceUrl:             'https://wa.me/233533416608',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData.buffer) {
      adReply.thumbnail = imgData.buffer;
    } else if (imgData.source?.startsWith('http')) {
      adReply.thumbnailUrl = imgData.source;
      adReply.originalImageUrl = imgData.source;
    }

    // ── Tier 1: sendButtonsCard with image header + payment quote ────────
    if (imagePayload) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       noteContent,
          footer:     footerText,
          title:      `\u{1F4B3} ${toSmallcaps('Command Invoice')} \u{1F4B3}`,
          subtitle:   `${toSmallcaps('Total Commands')}: ${menuData.totalCommands} \u2502 ${toSmallcaps('Uptime')}: ${menuData.uptime}`,
          thumbnail:  imagePayload,
          buttons: [
            buildPillButton('\u{1F3D1} Ping Speed',         `${menuData.prefix}ping`),
            buildPillButton('\u{1F4CB} Command List',       `${menuData.prefix}menulist`),
            buildPillButton('\u{1F916} System Stats',        `${menuData.prefix}menu aiDynamic`),
            buildPillUrlButton('\u{1F4AC} Contact Dev',     'https://wa.me/233533416608'),
            buildPillCopyButton('\u{1F4CE} Copy Prefix',    menuData.prefix),
            buildNavigationButton(menuData.prefix),
          ],
          contextInfo: { externalAdReply: adReply },
        }, { quoted: paymentQuote });
      } catch (err) {
        console.warn('[MENU payment] Tier 1 (sendButtonsCard + payment quote) failed, trying native payment:', err.message);
      }
    }

    // ── Tier 2: Native payment card (business accounts only) ──────────────
    try {
      return await baileysBridge.sendPayment(sock, m.from, {
        amount:   45000,
        currency: 'USD',
        note:     noteContent,
        expiry:   Math.floor(Date.now() / 1000) + 86400,
        image:    imgData?.buffer ?? null,
      }, { quoted: menuData.audioQuote || m });
    } catch (err) {
      console.warn('[MENU payment] Tier 2 (payment card) failed:', err.message);
    }

    // ── Tier 3: Guaranteed plain text + fake quote + banner ───────────────
    const fakeImgQuote = buildFakeImageQuote({ jpegThumbnail: imgData?.buffer || undefined });
    return await sock.sendMessage(m.from, {
      text:        noteContent,
      contextInfo: { externalAdReply: adReply },
    }, { quoted: fakeImgQuote });
  },
};

export default paymentMenu;
