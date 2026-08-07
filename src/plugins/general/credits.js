/**
 * @file src/plugins/general/credits.js
 *
 * .credits — Shows bot creator, framework, version, and signature.
 * Wraps the unused src/core/credits.js module as a user-facing command.
 *
 * Uses sendButtonsCard with a fake product catalog quote (like .about)
 * for visual consistency with other info commands.
 */

import { baileysBridge } from '../../core/baileysBridge.js';
import { capabilities } from '../../core/capabilities.js';
import { buildFakeProductQuote } from '../../lib/waUtils.js';
import { buildNavigationButton } from '../../menu/types/buttonsCard.js';
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

    const bodyText =
      `\u2726 *${brand.name} Credits* \u2726\n\n` +
      `\u{1F4BB} *Developer:*\n   ${credits.getCreator()}\n\n` +
      `\u{1F3D7}\uFE0F *Framework:*\n   ${credits.getProject()}\n\n` +
      `\u{1F4E6} *Version:*\n   v${credits.getVersion()}\n\n` +
      `\u{1F4DC} *Signature:*\n   ${credits.getSignature()}`;

    const footerText = `\u00A9 ${brand.name} by ${brand.creator}`;

    // Build product catalog quote
    let contextInfo;
    try {
      const catalogQuote = buildFakeProductQuote({
        title:           brand.name,
        description:    `by ${brand.creator}`,
        currencyCode:   'USD',
        priceAmount1000: 0,
      });
      contextInfo = {
        stanzaId:      catalogQuote.key.id,
        participant:    catalogQuote.key.participant,
        remoteJid:      catalogQuote.key.remoteJid,
        quotedMessage:  catalogQuote.message,
      };
    } catch (_) {
      contextInfo = {};
    }

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
