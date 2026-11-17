/**
 * brandSheet.js — the reusable full-screen "brand details" sheet.
 *
 * `.brand` proved the shape: an interactiveMessage whose `booking_confirmation`
 * native-flow button paints a pill under the bubble, and tapping it opens a
 * full-screen sheet with a header, a body of sections, and a green CTA. That
 * sheet is the part worth reusing — the card chrome (vCard quote, mock booking
 * fields, display labels) is identical for every command that wants it, only
 * the content changes.
 *
 * Usage:
 *   await sendBrandSheet(sock, m.from, {
 *     title: 'NEXORA MD',
 *     body: '» *NEXORA MD*\n  › compact bubble text',
 *     sections: [{ heading: 'Our Team', lines: ['Moonson — Founder'] }],
 *     cta: 'credits',
 *     quoted: m,
 *   })
 *
 * Everything is data: `sections` is `[{ heading, lines }]`, and `cta` picks a
 * label preset instead of raw snake_case keys. Returns true when the relay
 * accepted the card, so callers can fall back to a button card or text.
 */
import { Button } from './moonsonKit.js';
import { buildBrandContactQuote } from './brandContact.js';
import brand from '../../config/brand.js';
import owner from '../../config/owner.js';

/** CTA label presets — the only per-command cosmetic differences. */
export const CTA_PRESETS = {
  brand: {
    display_text: '📊 View Brand Details',
    sheetType: 'Brand Information',
    addToCalendar: 'BRAND',
    viewOnMaps: 'View Website',
    manage: '📱 Contact',
    manageUnsupported: 'Brand Info',
    readMore: 'View Details',
  },
  credits: {
    display_text: '📊 View Credits',
    sheetType: 'Credits',
    addToCalendar: 'CREDITS',
    viewOnMaps: 'View Source',
    manage: '📱 Contact Dev',
    manageUnsupported: 'Credits',
    readMore: 'View Details',
  },
  info: {
    display_text: '📊 View Details',
    sheetType: 'Information',
    addToCalendar: 'INFO',
    viewOnMaps: 'Open Link',
    manage: '📱 Contact',
    manageUnsupported: 'Info',
    readMore: 'View Details',
  },
};

/** Turn structured sections into the sheet's markdown body. */
export function renderSections(sections = []) {
  return sections
    .filter((s) => s && (s.heading || s.lines?.length))
    .map((s) => {
      const head = s.heading ? `» *${s.heading}*` : '';
      const lines = (s.lines || [])
        .filter((l) => l != null && l !== '')
        .map((l) => `  › ${l}`)
        .join('\n');
      return [head, lines].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/**
 * @param {object} sock
 * @param {string} jid
 * @param {object} opts
 * @param {string} opts.title            Sheet header (`📋 <title>`)
 * @param {string} opts.body             Bubble body
 * @param {string} [opts.footer]
 * @param {string} [opts.description]    Sheet content; built from `sections` when omitted
 * @param {Array}  [opts.sections]       [{ heading, lines }]
 * @param {string} [opts.cta='brand']    Preset name from CTA_PRESETS, or a preset object
 * @param {string} [opts.websiteUrl]     Where the sheet's website CTA points
 * @param {string} [opts.phone]          Contact number for the sheet's Contact CTA
 * @param {object} [opts.quoted]         Quoted message (defaults to the brand contact bubble)
 * @param {boolean}[opts.greenBubble=false] Attach the vCard bubble as the quoted
 *                                        context. Off by default: a real
 *                                        `quoted` reply overrides it, and the
 *                                        sheet's green CTA is the contact
 *                                        affordance users actually tap.
 * @returns {Promise<boolean>} true when relayed
 */
export async function sendBrandSheet(sock, jid, {
  title,
  body,
  footer,
  description,
  sections,
  cta = 'brand',
  websiteUrl,
  phone,
  quoted,
  greenBubble = false,
} = {}) {
  const botName = brand.name;
  const d = brand.display || {};
  const displayName = d.name || botName;
  // The bot's own JID is the reliable number: config's PAIRING_PHONE /
  // OWNER_NUMBERS are often unset in production, which used to ship a sheet
  // whose Contact CTA pointed at wa.me/000000000000.
  const sessionNumber = (sock?.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
  const configNumber = (owner.ownerNumber || '').replace(/[^0-9]/g, '');
  const usableConfig = configNumber && !/^0+$/.test(configNumber) ? configNumber : '';
  const explicit = (phone || '').replace(/[^0-9]/g, '');
  const numbers = (explicit && !/^0+$/.test(explicit) ? explicit : '') || sessionNumber || usableConfig;
  const siteUrl = websiteUrl
    || process.env.BRAND_WEBSITE
    || `https://wa.me/${numbers}`;

  const preset = typeof cta === 'string' ? (CTA_PRESETS[cta] || CTA_PRESETS.brand) : cta;
  const sheetDescription = description || renderSections(sections);
  const contactQuote = greenBubble ? buildBrandContactQuote({ botName }) : null;

  const card = new Button(sock)
    .setTitle(`🖥️ ${title || displayName}`)
    .setBody(body || renderSections(sections))
    .setFooter(footer || d.copyright || brand.copyright || `© ${displayName}`);

  if (contactQuote) {
    card.setContextInfo({
      mentionedJid: [],
      stanzaId: contactQuote.key.id,
      participant: contactQuote.key.participant,
      remoteJid: contactQuote.key.remoteJid,
      quotedMessage: contactQuote.message,
    });
  }

  card.addButton('booking_confirmation', {
    start_datetime: new Date().toISOString(),
    end_datetime: new Date(Date.now() + 600000).toISOString(),
    location: botName,
    booking_url: siteUrl,
    phone_number: numbers,
    booking_management_url: `https://wa.me/${numbers}`,
    description: sheetDescription,
    email: '',
    display_text: preset.display_text,
    display_content: {
      display_language: 'en',
      display_meeting_type: preset.sheetType,
      display_bottom_sheet_header: `📋 ${title || displayName}`,
      display_add_to_calendar_cta_text: preset.addToCalendar,
      display_view_on_maps_cta_text: preset.viewOnMaps,
      display_manage_booking_cta_text: preset.manage,
      display_manage_booking_not_supported_text: preset.manageUnsupported,
      display_read_more: preset.readMore,
    },
  });

  await card.send(jid, quoted ? { quoted } : {});
  return true;
}

export default sendBrandSheet;
