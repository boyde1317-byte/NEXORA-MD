/**
 * @file src/plugins/general/credits.js
 *
 * .credits — creator, framework, version and signature, shown as the same
 * full-screen sheet `.brand` opens (lib/brandSheet.js), with a green
 * "Contact Dev" CTA and the brand contact bubble in the reply bar.
 *
 * Tier order:
 *   0. brand sheet (interactiveMessage + booking_confirmation)
 *   1. VIP rich card
 *   2. sendButtonsCard pill buttons
 *   3. plain text with enrichment
 */

import { baileysBridge } from '../../core/baileysBridge.js';
import { sendCreditsRich } from '../../lib/vipSurfaces.js';
import { capabilities } from '../../core/capabilities.js';
import { buildNavigationButton } from '../../menu/types/buttonsCard.js';
import { buildEnrichedContextInfo } from '../../lib/enrichContext.js';
import { buildBrandContactQuote } from '../../lib/brandContact.js';
import { sendBrandSheet } from '../../lib/brandSheet.js';
import credits from '../../core/credits.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
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
    const devName   = d.creator || credits.getCreator();
    const phone     = (owner.ownerNumber || '').replace(/[^0-9]/g, '');
    const sourceUrl = 'https://github.com/boyde1317-byte/NexoraFlex';

    const sections = [
      { heading: 'Developed By', lines: [devName] },
      { heading: 'Founder', lines: [`${owner.ownerName} — Founder & Developer`] },
      { heading: 'Framework', lines: [d.name || credits.getProject()] },
      { heading: 'Version', lines: [`v${credits.getVersion()}`] },
      { heading: 'Signature', lines: [d.signature || credits.getSignature()] },
      { heading: 'Source', lines: [sourceUrl] },
    ];

    const bodyText =
      `» *${d.name || brand.name} Credits*\n` +
      `  › 💻 ${devName}\n` +
      `  › 🏗️ ${d.name || credits.getProject()} · v${credits.getVersion()}\n\n` +
      `_Tap the button for the full credits sheet._`;

    const footerText = `© ${d.name || brand.name} by ${devName}`;

    // ── Tier 0: the brand sheet, with the green contact bubble ──
    try {
      await sendBrandSheet(sock, m.from, {
        title: d.name || brand.name,
        body: bodyText,
        footer: footerText,
        sections,
        cta: 'credits',
        websiteUrl: sourceUrl,
        phone,
        quoted: m,
      });
      return;
    } catch (err) {
      console.warn('[credits] brand sheet failed, using the VIP card:', err.message);
    }

    const contextInfo = await buildEnrichedContextInfo({
      newsletterName: `${brand.name} Updates`,
      caption:        `${d.tagline || d.description || brand.tagline || brand.description || 'Made with \u2665\uFE0F By ' + devName}`,
      adTitle:        d.name || brand.name,
      adBody:         d.tagline || `By ${devName}`,
      sourceUrl,
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

    // ── Tier 1: VIP rich card ──
    try {
      await sendCreditsRich(sock, m.from, {
        markdown: credits.getFullCredits(),
        title: d.name || brand.name,
        subtitle: d.tagline || 'The people behind the bot',
        quoted: m,
      });
      return;
    } catch (err) {
      console.warn('[credits] VIP card failed, using the button card:', err.message);
    }

    // ── Tier 2: sendButtonsCard ──
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

    // ── Tier 3: plain text with enrichment ──
    return await sock.sendMessage(m.from, {
      text:         credits.getFullCredits(),
      contextInfo:  contactContext,
    }, { quoted: m });
  },
};
