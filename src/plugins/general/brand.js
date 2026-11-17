/**
 * @file src/plugins/general/brand.js
 *
 * .brand — the NIXCODE brand card: a bubble with a "📊 View Brand Details"
 * pill that opens a full-screen sheet (description, stack, team, links) with
 * a green Contact CTA.
 *
 * The card shape itself now lives in lib/brandSheet.js, so any command can
 * paint the same sheet from data; this plugin only supplies the content.
 * interactiveMessage + nativeFlowMessage render on all modern clients, so no
 * bot-verification certificate is involved (unlike the AIRich envelope).
 */

import { sendBrandSheet, renderSections } from '../../lib/brandSheet.js';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';
import { config } from '../../../config/index.js';

export default {
  name: 'brand',
  aliases: ['brandcard'],
  category: 'general',
  description: 'Interactive brand card with a full-screen brand details sheet (NIXCODE card).',
  cooldown: 5000,
  execute: async ({ sock, m }) => {
    try {
      const d            = brand.display || {};
      const displayName  = d.name || brand.name;
      // The bot's own JID is the dependable number; config falls back to zeros
      // when PAIRING_PHONE/OWNER_NUMBERS are unset in production.
      const sessionNum   = (sock?.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
      const ownerNum     = (owner.ownerNumber || '').replace(/[^0-9]/g, '');
      const phone        = sessionNum || (/^0+$/.test(ownerNum) ? '' : ownerNum);
      const groupLink    = process.env.BRAND_GROUP_LINK
        || 'https://chat.whatsapp.com/GUgEw0Nd6CeEEmX7AQwnoQ';
      const channelLink  = process.env.BRAND_CHANNEL_LINK
        || `https://whatsapp.com/channel/${(config.channelJid || '').replace('@newsletter', '')}`;
      const websiteLink  = process.env.BRAND_WEBSITE || `https://wa.me/${phone}`;

      // Sheet content, as data — the shared renderer turns it into the
      // sheet's » / › markdown.
      const sections = [
        { heading: displayName, lines: [d.description || brand.description] },
        {
          heading: 'Who We Are',
          lines: [
            `${d.core || brand.core} · ${d.engine || brand.engine}`,
            `${d.ui || brand.ui} · ${d.plugins || brand.plugins}`,
          ],
        },
        {
          heading: 'What We Do',
          lines: [
            'WhatsApp Bot Framework',
            'Automation & Digital Solutions',
            'Custom Command Development',
          ],
        },
        {
          heading: 'Our Stack',
          lines: [
            `${displayName} — v${brand.version}`,
            `${d.security || brand.security} · ${d.ai || brand.ai}`,
          ],
        },
        { heading: 'Our Team', lines: [`${owner.ownerName} — Founder & Developer`] },
        { heading: 'Mission', lines: [d.tagline || brand.tagline] },
        {
          heading: 'Values',
          lines: ['Innovation · Simplicity · Reliability', 'Community-Driven'],
        },
        {
          heading: 'Connect With Us',
          lines: [
            `WhatsApp: wa.me/${phone}`,
            `Group: ${groupLink}`,
            `Channel: ${channelLink}`,
          ],
        },
      ];

      const description =
        `${renderSections(sections)}\n\n` +
        `_Powered by ${displayName} — ${d.signature || brand.signature}_`;

      const body =
        `» *${displayName}*\n` +
        `  › ${d.description || brand.description}\n\n` +
        `» *Your Tech Hub*\n` +
        `  › Bots · Automation · Digital Solutions\n\n` +
        `_Tap the button below for full details._`;

      await sendBrandSheet(sock, m.from, {
        title: displayName,
        body,
        description,
        cta: 'brand',
        websiteUrl: websiteLink,
        phone,
        quoted: m,
      });
    } catch (err) {
      console.error('[brand] Error:', err);
      return await m.reply.error(`Failed to render brand card: ${err.message}`);
    }
  },
};
