/**
 * @file src/plugins/general/brand.js
 *
 * .brand — Moonson-style brand card, ported onto moonsonKit.
 *
 * This is the showpiece port of Moonson's commands/information/brand.js:
 * the same interactiveMessage card with the `booking_confirmation`
 * nativeFlow button that renders as the "📊 View Brand Details" pill —
 * tapping it opens a full-screen brand sheet (description, contact rows,
 * calendar-style CTA labels via display_content).
 *
 * Why this one ports cleanly (unlike .ping/.store in Moonson, which ride
 * the AIRich GenAI envelope): interactiveMessage + nativeFlowMessage render
 * on all modern clients — no bot-verification certificate involved.
 *
 * Differences vs Moonson's .brand:
 *   - built with moonsonKit.Button (fluent NIXCODE API) and sent through
 *     baileysBridge.relayMessage (messageSecret + biz stanza handled)
 *   - brand/config values come from Nexora's config (config/brand.js,
 *     config/owner.js) with env overrides for links
 *   - contextInfo carries the status-quoted contact card exactly like
 *     Moonson (quoted contactMessage vcard of the bot)
 */

import { Button } from '../../lib/moonsonKit.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { config } from '../../../config/index.js';
import { buildBrandContactQuote } from '../../lib/brandContact.js';

export default {
  name: 'brand',
  aliases: ['brandcard'],
  category: 'general',
  description: 'Interactive brand card with a full-screen brand details sheet (NIXCODE card).',
  cooldown: 5000,
  execute: async ({ sock, m }) => {
    try {
      const botName      = brand.name;
      // Styled variants for the human-read surfaces (title, body, sheet,
      // footer). Structured metadata — vCard, contact displayName, booking
      // location — keeps the plain botName below.
      const d            = brand.display || {};
      const displayName  = d.name || brand.name;
      const creator      = d.creator || brand.creator;
      const phone       = (owner.ownerNumber || '').replace(/[^0-9]/g, '');
      const groupLink   = process.env.BRAND_GROUP_LINK || `https://wa.me/${phone}`;
      const channelLink = process.env.BRAND_CHANNEL_LINK
        || `https://whatsapp.com/channel/${(config.channelJid || '').replace('@newsletter', '')}`;
      const websiteLink = process.env.BRAND_WEBSITE || groupLink;
      const footer      = d.copyright || brand.copyright || `© ${botName}`;

      // Full sheet content — shown when the user taps the booking button
      const brandDescription =
        `» *${displayName}*\n` +
        `  › ${d.description || brand.description}\n\n` +
        `» *Who We Are*\n` +
        `  › ${d.core || brand.core} · ${d.engine || brand.engine}\n` +
        `  › ${d.ui || brand.ui} · ${d.plugins || brand.plugins}\n\n` +
        `» *What We Do*\n` +
        `  › WhatsApp Bot Framework\n` +
        `  › Automation & Digital Solutions\n` +
        `  › Custom Command Development\n\n` +
        `» *Our Stack*\n` +
        `  › ${displayName} — v${brand.version}\n` +
        `  › ${d.security || brand.security} · ${d.ai || brand.ai}\n\n` +
        `» *Our Team*\n` +
        `  › ${owner.ownerName} — Founder & Developer\n\n` +
        `» *Mission*\n` +
        `  › ${d.tagline || brand.tagline}\n\n` +
        `» *Values*\n` +
        `  › Innovation · Simplicity · Reliability\n` +
        `  › Community-Driven\n\n` +
        `» *Connect With Us*\n` +
        `  › WhatsApp: wa.me/${phone}\n` +
        `  › Group: ${groupLink}\n` +
        `  › Channel: ${channelLink}\n\n` +
        `_Powered by ${displayName} — ${d.signature || brand.signature}_`;

      // Compact card body — what renders in the chat bubble
      const outerBody =
        `» *${displayName}*\n` +
        `  › ${d.description || brand.description}\n\n` +
        `» *Your Tech Hub*\n` +
        `  › Bots · Automation · Digital Solutions\n\n` +
        `_Tap the button below for full details._`;

      // Status-quoted contact card (same reply-bar effect Moonson uses) —
      // shared with .credits via lib/brandContact.js.
      const contactQuote = buildBrandContactQuote({ botName, phone });

      const card = new Button(sock)
        .setTitle(`🖥️ ${displayName}`)
        .setBody(outerBody)
        .setFooter(footer)
        .setContextInfo({
          mentionedJid: [],
          stanzaId: 'StatusBiz',
          participant: '0@s.whatsapp.net',
          remoteJid: 'status@broadcast',
          quotedMessage: contactQuote.message,
        });

      // booking_confirmation — the same button type Moonson's .brand uses
      card.addButton('booking_confirmation', {
        start_datetime: new Date().toISOString(),
        end_datetime: new Date(Date.now() + 600000).toISOString(),
        location: botName,
        booking_url: websiteLink,
        phone_number: phone,
        booking_management_url: `https://wa.me/${phone}`,
        description: brandDescription,
        email: '',
        display_text: `📊 View Brand Details`,
        display_content: {
          display_language: 'en',
          display_meeting_type: 'Brand Information',
          display_bottom_sheet_header: `📋 ${displayName}`,
          display_add_to_calendar_cta_text: 'BRAND',
          display_view_on_maps_cta_text: 'View Website',
          display_manage_booking_cta_text: '📱 Contact',
          display_manage_booking_not_supported_text: 'Brand Info',
          display_read_more: 'View Details',
        },
      });

      await card.send(m.from, { quoted: m });
    } catch (err) {
      console.error('[brand] Error:', err);
      return await m.reply.error(`Failed to render brand card: ${err.message}`);
    }
  },
};
