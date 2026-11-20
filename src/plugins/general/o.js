/**
 * o.js — Rem-compatible owner details surface.
 *
 * Rem sends two layers: an AIRich rights/profile card followed by a
 * booking-style native-flow details card. This keeps that sequence while
 * using NexoraFlex's configured identity and fresh branded thumbnail.
 */
import { AIRich } from '../../lib/NIXCODE.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import brand from '../../../config/brand.js';

const OWNER_NUMBER = '233533416608';
const OWNER_URL = `https://wa.me/${OWNER_NUMBER}`;
const CHANNEL_URL = 'https://github.com/boyde1317-byte/nexoraflex';

export default {
  name: 'o',
  aliases: ['boos'],
  category: 'general',
  description: 'Shows the owner rights and contact details card.',
  cooldown: 3000,
  execute: async ({ sock, m }) => {
    const displayName = brand.display?.name || brand.name;
    const creator = brand.display?.creator || brand.creator;
    const rights = [
      `## ${displayName} • OWNER RIGHTS`,
      '',
      `**Developer:** ${creator}`,
      `**Contact:** +${OWNER_NUMBER}`,
      `**Rights:** All rights reserved`,
    ].join('\n');

    await new AIRich(sock)
      .setTitle(`${brand.name} • OWNER PROFILE`)
      .addImage(ASSET_URLS.thumbnail)
      .addEntity({
        title: displayName,
        subtitle: `Developer: ${creator}`,
        secondary: `© ${brand.name}`,
        id: OWNER_NUMBER,
        imageUrl: ASSET_URLS.thumbnail,
      })
      .addText(rights)
      .setFooter(`© ${brand.name} • ${creator}`)
      .send(m.from, { quoted: m });

    const description = [
      `Name: ${creator}`,
      `Number: +${OWNER_NUMBER}`,
      `Bot: ${brand.name}`,
      'Rights: All rights reserved',
    ].join('\n');
    await baileysBridge.sendInteractive(sock, m.from, {
      header: { title: `${brand.name} • OWNER DETAILS` },
      body: `## Owner information\n\n${description}`,
      footer: `© ${brand.name} • ${creator}`,
      contextInfo: { mentionedJid: [`${OWNER_NUMBER}@s.whatsapp.net`] },
      buttons: [
        {
          name: 'booking_confirmation',
          params: {
            start_datetime: new Date().toISOString(),
            end_datetime: new Date(Date.now() + 600000).toISOString(),
            location: 'NexoraFlex',
            booking_url: OWNER_URL,
            phone_number: `+${OWNER_NUMBER}`,
            booking_management_url: CHANNEL_URL,
            description,
            display_text: 'More Owner Info',
            display_content: {
              display_language: 'en',
              display_meeting_type: 'Info',
              display_bottom_sheet_header: `${brand.name} • OWNER RIGHTS`,
              display_add_to_calendar_cta_text: 'Add to Calendar',
              display_view_on_maps_cta_text: 'Owner',
              display_manage_booking_cta_text: 'Open Project',
              display_manage_booking_not_supported_text: `${brand.name} © 2026`,
              display_read_more: 'Read More',
            },
          },
        },
        {
          name: 'cta_url',
          params: { display_text: 'NexoraFlex Project', url: CHANNEL_URL },
        },
      ],
    }, { quoted: m });
  },
};
