/**
 * menu2.js — .menu2 / .help2 — interactive menu with a header image and
 * category picker.
 *
 * Ported from LUNA MD plugins/menu2.js as its own plugin (NOT a menu
 * type — it does not register a menu style and does not touch the menu
 * switcher). The interactiveMessage + single_select renderer is kept.
 *
 * Differences from the LUNA MD original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`; `m.pushName` ->
 *     getDisplayName(sock, m.sender).
 *   - The senderKeyDistributionMessage axolotl blob was a hardcoded
 *     base64 string; it is now a fresh crypto.randomBytes(32) per send.
 *   - Category rows pointed at `.menu <category>` (which in NexoraFlex
 *     selects a menu style, not a category). They now point at
 *     `.help <category>` — the house drill-down, same as the zapoMenu
 *     port (see nexora-new-features/PORT-NOTES.md).
 *   - The limited-time-offer URL was a placeholder wa.me link to the
 *     old dev's number; it is now wa.me/233533416608 (moonson). The quoted order context
 *     participant was the old dev number; now moonson's. Currency IDR ->
 *     USD (house convention).
 *   - Branding LUNA MD -> NEXORA MD; command count is real
 *     (client.commands.size) instead of the hardcoded "150+".
 *
 * NOTE: the header image used to be a hardcoded mmg.whatsapp.net signed
 * URL (with oh/oe expiry params) copied from the original — it expired,
 * so WhatsApp tried to download a 2.4 MB file that never arrived (the
 * "loads on tap but never finishes" bug). It now uses the NEXORA brand
 * banner (ASSET_URLS.menuBanner, a live jsDelivr URL, 269856 bytes,
 * 2048x1152) with matching fileLength/dimensions, and the stale
 * mediaKey/directPath/fileSha256 fields from the old upload are dropped
 * (they only apply to WhatsApp-hosted encrypted media).
 */
import crypto from 'node:crypto';
import { ASSET_URLS } from '../../assets/assetUrls.js';
import { resolveDisplayIdentity } from '../../lib/identity.js';

const OWNER_NUMBER = '233533416608';

export default {
  name: 'menu2',
  aliases: ['help2'],
  category: 'general',
  description: 'Interactive menu with header image and category picker.',
  cooldown: 3000,
  execute: async ({ m, sock, client }) => {
    // Username first, phone number next — never the raw LID digits.
    const id = await resolveDisplayIdentity(sock, m.sender, m.isGroup ? m.from : null);
    const name = id.username || id.number || id.pushName || 'there';
    const total = client?.commands?.size ?? 0;
    const footerText = `Good afternoon, *${name}!*\n\n╭┈┈⬡「 *BOT INFO* 」\n┃ ✧ NAME     : NEXORA MD\n┃ ✧ VERSION  : v2.2.2\n┃ ✧ UPTIME   : ${(process.uptime() / 3600).toFixed(1)}h\n┃ ✧ MODE     : PUBLIC\n┃ ✧ COMMANDS : ${total}\n╰┈┈┈┈┈┈┈┈⬡\n\n╭┈┈⬡「 *USER INFO* 」\n┃ ✧ NAME   : ${name}\n┃ ✧ ACCESS  :  USER\n┃ ✧ LIMIT  :  UNLIMITED\n╰┈┈┈┈┈┈┈┈⬡\n\n╭┈┈⬡「 *MENU LIST* 」\n┃ ✧ AI MENU\n┃ ✧ DOWNLOADER MENU\n┃ ✧ STICKER MENU\n┃ ✧ TOOLS MENU\n┃ ✧ GAME MENU\n┃ ✧ GROUP MENU\n┃ ✧ OWNER MENU\n╰┈┈┈┈⬡`;

    await sock.relayMessage(m.from, {
      senderKeyDistributionMessage: {
        groupId: m.from,
        axolotlSenderKeyDistributionMessage: crypto.randomBytes(32).toString('base64'),
      },
      interactiveMessage: {
        header: {
          imageMessage: {
            url: ASSET_URLS.menuBanner,
            mimetype: 'image/jpeg',
            fileLength: 269856,
            height: 1152,
            width: 2048,
            jpegThumbnail: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMWFhUXGBcYGBgYGBgYGBgYGBgYGBgYGBgYHSggGBolGxUYITEhJSkrLi4uGB8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIALcBFAMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABQYBBAcDAv/EADgQAAIBAwMCBAMFBQYEBwAAAAECEQADITEEEkEFIlFhBhMxgZGhBxMyQqHwB0JSocHR8AcVM2JygpKiwtLxQ3PC/8QAGQEAAwEBAQAAAAAAAAAAAAAAAQIDBAAF/8QAHREAAgICAwEBAAAAAAAAAAAAAQIAAxESITEyQVH/2gAMAwEAAhEDEQA/APNREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREH//2Q==', 'base64'),
          },
          hasMediaAttachment: true,
        },
        body: { text: '' },
        footer: { text: footerText },
        nativeFlowMessage: {
          buttons: [
            { name: '', buttonParamsJson: JSON.stringify({}) },
            {
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                icon: 'DOCUMENT',
                title: 'MENU',
                sections: [
                  {
                    title: 'CATEGORY',
                    highlight_label: 'NEXORA MENU',
                    rows: [
                      { title: 'AI', description: 'AI features', id: '.help ai' },
                      { title: 'DOWNLOADER', description: 'Downloader menu', id: '.help downloader' },
                      { title: 'STICKER', description: 'Sticker maker', id: '.help sticker' },
                      { title: 'TOOLS', description: 'Tools menu', id: '.help tools' },
                      { title: 'GAME', description: 'Game menu', id: '.help game' },
                      { title: 'GROUP', description: 'Group menu', id: '.help group' },
                      { title: 'OWNER', description: 'Owner menu', id: '.help owner' },
                    ],
                  },
                ],
              }),
            },
            {
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                icon: 'REVIEW',
                title: 'INFO',
                sections: [{
                  title: 'INFORMATION',
                  highlight_label: 'INFORMATION',
                  rows: [
                    { title: 'PING', id: '.ping' },
                    { title: 'OWNER', id: '.owner' },
                    { title: 'CRM', id: '.crm' },
                  ],
                }],
              }),
            },
          ],
          messageParamsJson: JSON.stringify({
            limited_time_offer: {
              text: 'NEXORA MD',
              url: `https://wa.me/${OWNER_NUMBER}`,
              copy_code: 'Dev MOONSON | NEXORA MD',
              expiration_time: Date.now() + 3600000,
            },
          }),
        },
        contextInfo: {
          participant: '0@s.whatsapp.net',
          quotedMessage: {
            orderMessage: {
              orderId: '1788164536288',
              thumbnail: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMWFhUXGBcYGBgYGBgYGBgYGBgYGBgYHSggGBolGxUYITEhJSkrLi4uGB8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIALcBFAMBIgACEQEDEQH/xAAbAAEAAgMBAQAAAAAAAAAAAAAABQYBBAcDAv/EADgQAAIBAwMCBAMFBQYEBwAAAAECEQADITEEEkEFIlFhBhMxgZGhBxMyQqHwB0JSocHR8AcVM2JygpKiwtLxQ3PC/8QAGQEAAwEBAQAAAAAAAAAAAAAAAQIDBAAF/8QAHREAAgICAwEBAAAAAAAAAAAAAQIAAxESITEyQVH/2gAMAwEAAhEDEQA/APNREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREH//2Q==', 'base64'),
              itemCount: 2026,
              status: 0,
              surface: 0,
              message: '© NEXORA MD | Dev MOONSON',
              orderTitle: '',
              sellerJid: '0@s.whatsapp.net',
              totalAmount1000: 0,
              totalCurrencyCode: 'USD',
            },
          },
          remoteJid: 'status@broadcast',
          forwardingScore: 0,
          isForwarded: false,
        },
      },
    }, {
      additionalNodes: [
        {
          tag: 'biz',
          attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: '1710184201' },
          content: [
            { tag: 'engagement', attrs: { customer_service_state: 'open', conversation_state: 'open' } },
            { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] },
          ],
        },
      ],
    });
  },
};
