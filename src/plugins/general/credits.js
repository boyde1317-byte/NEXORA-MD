/**
 * @file src/plugins/general/credits.js
 *
 * .credits — Shows bot creator, framework, version, and signature.
 * Wraps src/core/credits.js as a user-facing command.
 *
 * Visual stack:
 *   1. Newsletter admin invite quote (newsletterAdminInviteMessage) — gives
 *      the reply bar a "invited to channel" look instead of a product catalog.
 *   2. externalAdReply thumbnail — small link-preview banner with the bot's
 *      logo and a source URL, rendered inside contextInfo.
 *   3. sendButtonsCard pill buttons — universal WhatsApp client compatibility.
 */

import { baileysBridge } from '../../core/baileysBridge.js';
import { capabilities } from '../../core/capabilities.js';
import { buildFakeNewsletterQuote } from '../../lib/waUtils.js';
import { buildNavigationButton } from '../../menu/types/buttonsCard.js';
import credits from '../../core/credits.js';
import brand from '../../../config/brand.js';
import { config } from '../../../config/index.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';

export default {
  name:        'credits',
  aliases:     ['credit', 'dev'],
  category:    'general',
  description: 'Shows bot developer, framework, and version credits.',
  cooldown:    5000,

  execute: async ({ sock, m }) => {
    const p = config.prefix[0] || '.';

    const bodyText =
      `\u2726 *${brand.name} Credits* \u2726\n\n` +
      `\u{1F4BB} *Developer:*\n   ${credits.getCreator()}\n\n` +
      `\u{1F3D7}\uFE0F *Framework:*\n   ${credits.getProject()}\n\n` +
      `\u{1F4E6} *Version:*\n   v${credits.getVersion()}\n\n` +
      `\u{1F4DC} *Signature:*\n   ${credits.getSignature()}`;

    const footerText = `\u00A9 ${brand.name} by ${brand.creator}`;

    // ── Newsletter admin invite quote ────────────────────────────────────
    let contextInfo;
    try {
      const newsletterQuote = buildFakeNewsletterQuote({
        newsletterName: `${brand.name} Updates`,
        caption:        `${brand.tagline || brand.description || 'Made with \u2665\uFE0F By ' + brand.creator}`,
      });
      contextInfo = {
        stanzaId:      newsletterQuote.key.id,
        participant:    newsletterQuote.key.participant,
        remoteJid:      newsletterQuote.key.remoteJid,
        quotedMessage:  newsletterQuote.message,
      };
    } catch (_) {
      contextInfo = {};
    }

    // ── externalAdReply thumbnail banner ──────────────────────────────────
    contextInfo.externalAdReply = {
      title:                  brand.name,
      body:                   `${brand.tagline || 'By ' + brand.creator}`,
      sourceUrl:              'https://github.com/boyde1317-byte/NEXORA-MD',
      mediaType:              1,
      renderLargerThumbnail:  false,
      showAdAttribution:      false,
      thumbnailUrl:           ASSET_URLS.thumbnail,
    };

    const buttons = [
      { displayText: '\u{1F4AC} Contact Dev', id: `${p}owner`, type: 1 },
      { displayText: '\u2139\uFE0F About',     id: `${p}about`, type: 1 },
      buildNavigationButton(p),
    ];

    // Tier 1: sendButtonsCard
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      brand.name,
          subtitle:   `v${brand.version}`,
          buttons,
          contextInfo,
        }, { quoted: m });
      } catch (err) {
        console.warn('[credits] Tier 1 (buttonsCard) failed:', err.message);
      }
    }

    // Tier 2: plain text
    return await sock.sendMessage(m.from, {
      text: credits.getFullCredits(),
    }, { quoted: m });
  },
};
