/**
 * @file src/plugins/general/credits.js
 *
 * .credits — Shows bot creator, framework, version, and signature.
 * Wraps src/core/credits.js as a user-facing command.
 *
 * Visual stack (via buildEnrichedContextInfo):
 *   1. Newsletter admin invite quote (newsletterAdminInviteMessage)
 *   2. externalAdReply thumbnail banner with bot logo + source URL
 *   3. sendButtonsCard pill buttons — universal WhatsApp client compatibility
 */

import { baileysBridge } from '../../core/baileysBridge.js';
import { sendCreditsRich } from '../../lib/vipSurfaces.js';
import { capabilities } from '../../core/capabilities.js';
import { buildNavigationButton } from '../../menu/types/buttonsCard.js';
import { buildEnrichedContextInfo } from '../../lib/enrichContext.js';
import { buildBrandContactQuote } from '../../lib/brandContact.js';
import credits from '../../core/credits.js';
import brand from '../../../config/brand.js';
import { config } from '../../../config/index.js';

export default {
  name:        'credits',
  aliases:     ['credit', 'dev'],
  category:    'general',
  description: 'Shows bot developer, framework, and version credits.',
  cooldown:    5000,

  execute: async ({ sock, m }) => {
    const p = config.prefix[0] || '.';
    const d = brand.display || {};

    const bodyText =
      `\u2726 *${d.name || brand.name} Credits* \u2726\n\n` +
      `\u{1F4BB} *Developer:*\n   ${d.creator || credits.getCreator()}\n\n` +
      `\u{1F3D7}\uFE0F *Framework:*\n   ${d.name || credits.getProject()}\n\n` +
      `\u{1F4E6} *Version:*\n   v${credits.getVersion()}\n\n` +
      `\u{1F4DC} *Signature:*\n   ${d.signature || credits.getSignature()}`;

    const footerText = `\u00A9 ${d.name || brand.name} by ${d.creator || brand.creator}`;

    // ── Enriched contextInfo: newsletter quote + externalAdReply banner ──
    const contextInfo = buildEnrichedContextInfo({
      newsletterName: `${brand.name} Updates`,
      caption:        `${d.tagline || d.description || brand.tagline || brand.description || 'Made with \u2665\uFE0F By ' + brand.creator}`,
      adTitle:        d.name || brand.name,
      adBody:         d.tagline || `By ${d.creator || brand.creator}`,
      sourceUrl:      'https://github.com/boyde1317-byte/NEXORA-MD',
    });

    // The green contact bubble `.brand` shows: the bot's own vCard as the
    // quoted context, so the reply bar paints a contact card above the sheet.
    const contactQuote = buildBrandContactQuote();
    const contactContext = {
      ...contextInfo,
      stanzaId:      contactQuote.key.id,
      participant:   contactQuote.key.participant,
      remoteJid:     contactQuote.key.remoteJid,
      quotedMessage: contactQuote.message,
    };

    const buttons = [
      { displayText: '\u{1F4AC} Contact Dev', id: `${p}owner`, type: 1 },
      { displayText: '\u2139\uFE0F About',     id: `${p}about`, type: 1 },
      buildNavigationButton(p),
    ];

    // Tier 0: VIP rich card — this command only displays, so the toast-only
    // CTAs inside the envelope cost nothing.
    try {
      await sendCreditsRich(sock, m.from, {
        markdown: credits.getFullCredits(),
        title: d.name || brand.name,
        subtitle: d.tagline || 'The people behind the bot',
        quoted: contactQuote,
      });
      return;
    } catch (err) {
      console.warn('[credits] VIP card failed, using the button card:', err.message);
    }

    // Tier 1: sendButtonsCard
    if (capabilities.nativeFlow) {
      try {
        return await baileysBridge.sendButtonsCard(sock, m.from, {
          body:       bodyText,
          footer:     footerText,
          title:      d.name || brand.name,
          subtitle:   `v${brand.version}`,
          buttons,
          contextInfo: contactContext,
        }, { quoted: m });
      } catch (err) {
        console.warn('[credits] Tier 1 (buttonsCard) failed:', err.message);
      }
    }

    // Tier 2: plain text with enrichment
    return await sock.sendMessage(m.from, {
      text:         credits.getFullCredits(),
      contextInfo:  contactContext,
    }, { quoted: m });
  },
};
