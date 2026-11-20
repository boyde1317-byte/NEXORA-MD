/**
 * o2.js — .o2 — owner / developer card.
 *
 * Ported from the LUNA MD o plugin (luna-md/plugins/o.js). Two messages,
 * same as the original: a GenAI entity card, then an interactive owner
 * card with a booking-style button. Rebranded throughout:
 *
 *   - LUNA MD -> NEXORA MD, dev phone 212674375708 -> moonson's
 *     233533416608, country Morocco -> Ghana.
 *   - The kappa.lol images (LUNA's hosts) are gone; the entity image
 *     and header media use the NEXORA brand assets (logo / banner).
 *   - The WhatsApp channel button is dropped (no hardcoded channel
 *     links); the second button is a wa.me chat link instead.
 *   - The yono.alya.bot@gmail.com address is dropped — no old-owner
 *     contact details are carried over.
 *   - The relay calls get a fresh crypto.randomBytes(32) messageSecret
 *     per send instead of none; on relay failure the plugin falls back
 *     to plain text instead of only flipping the reaction to ❌.
 *
 * Why o2 and not o: NexoraFlex already ships src/plugins/general/o.js
 * (.o), so this one stays separate and the existing command is untouched.
 */
import crypto from 'crypto';
import { ASSET_URLS } from '../../assets/assetUrls.js';

const DEV_PHONE = '233533416608';
const DEV_NAME = 'MOONSON';
const WA_URL = `https://wa.me/${DEV_PHONE}`;

export default {
  name: 'o2',
  aliases: [],
  category: 'general',
  description: "Show the NEXORA MD owner card.",
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    await sock.sendMessage(m.from, { react: { text: '⌛', key: m.key } }).catch(() => {});

    try {
      const entityPayload = {
        response_id: `nexora-owner-card-${crypto.randomUUID()}`,
        sections: [
          {
            view_model: {
              primitive: {
                media: { url: ASSET_URLS.menuBanner, mime_type: 'image/jpeg', width: 16, height: 9 },
                imagine_type: 'IMAGE',
                status: { status: 'READY' },
                __typename: 'GenAIImagePrimitive',
              },
              __typename: 'GenAISingleLayoutViewModel',
            },
          },
          {
            view_model: {
              primitive: {
                __typename: 'GenAICompactEntityPrimitive',
                title: 'NEXORA MD',
                subtitle: 'Developer: MOONSON',
                secondary_subtitle: '© 2026 NEXORA MD',
                entity_id: DEV_PHONE,
                entity_url: WA_URL,
                entity_type: 'PAGE',
                action_type: 'FOLLOW',
                is_verified: true,
                image: { url: ASSET_URLS.thumbnail, url_fallback: ASSET_URLS.thumbnail },
              },
              __typename: 'GenAISingleLayoutViewModel',
            },
          },
          {
            view_model: {
              primitive: {
                text: `*乂  NEXORA MD  ◦  RIGHTS*\n\n*© 2026 NEXORA MD*\n*👤 Developer:* MOONSON\n*📞 Number:* +${DEV_PHONE}\n*🌍 Country:* Ghana\n*⚡ All Rights Reserved*`,
                __typename: 'GenAIMarkdownTextUXPrimitive',
              },
              __typename: 'GenAISingleLayoutViewModel',
            },
          },
          {
            view_model: {
              primitive: {
                text: `© Powered by NEXORA MD | MOONSON - ${DEV_PHONE}`,
                __typename: 'GenAIMetadataTextPrimitive',
              },
              __typename: 'GenAISingleLayoutViewModel',
            },
          },
        ],
      };

      await sock.relayMessage(m.from, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              submessages: [{ messageType: 2, messageText: `NEXORA MD by MOONSON - ${DEV_PHONE}` }],
              messageType: 1,
              unifiedResponse: { data: Buffer.from(JSON.stringify(entityPayload)).toString('base64') },
              contextInfo: { forwardingScore: 2, isForwarded: true, forwardOrigin: 4 },
            },
          },
        },
      }, {});

      await sock.relayMessage(m.from, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        interactiveMessage: {
          header: { title: '𝗢 𝗪 𝗡 𝗘 𝗥   ◦   𝗗 𝗘 𝗧 𝗔 𝗜 𝗟 𝗦', hasMediaAttachment: false },
          body: {
            text: `*乂  𝗢 𝗪 𝗡 𝗘 𝗥     ◦     𝗜 𝗡 𝗙 𝗢*\n\n✧ Tag : \n      ◦ @${DEV_PHONE} 🇬🇭\n\n✧ Rights : \n      ◦ © 2026 NEXORA MD\n      ◦ Developer MOONSON\n      ◦ All Rights Reserved`,
          },
          footer: { text: `© 2026 NEXORA MD • MOONSON • ${DEV_PHONE}` },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'booking_confirmation',
                buttonParamsJson: JSON.stringify({
                  icon: 'default',
                  start_datetime: '2026-06-10T10:37:10.967Z',
                  end_datetime: '2026-06-10T10:47:10.967Z',
                  location: 'Ghana',
                  booking_url: WA_URL,
                  phone_number: `+${DEV_PHONE}`,
                  description: `*◦ 👤 Name  :*  MOONSON\n*◦ 📞 Number  :*  +${DEV_PHONE}\n*◦ 🤖 Bot  :*  NEXORA MD\n*◦ ⚡ Rights  :*  © 2026 All Rights Reserved`,
                  display_text: '𝐌𝐨𝐫𝐞 𝐎𝐰𝐧𝐞𝐫 𝐈𝐧𝐟𝐨',
                  display_content: {
                    display_language: 'En',
                    display_meeting_type: '𝐈𝐧𝐟𝐨',
                    display_bottom_sheet_header: '々   NEXORA MD RIGHTS   々',
                    display_add_to_calendar_cta_text: 'CALENDAR',
                    display_view_on_maps_cta_text: 'O W N E R',
                    display_manage_booking_cta_text: '𝐂𝐡𝐚𝐭',
                    display_manage_booking_not_supported_text: 'NEXORA MD © 2026',
                    display_read_more: 'READ MORE',
                  },
                }),
              },
              {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                  display_text: '𝐂𝐡𝐚𝐭 𝐨𝐧 𝐖𝐡𝐚𝐭𝐬𝐀𝐩𝐩',
                  url: WA_URL,
                }),
              },
            ],
            messageParamsJson: '',
          },
          contextInfo: { mentionedJid: [`${DEV_PHONE}@s.whatsapp.net`] },
        },
      }, {});

      await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (err) {
      console.warn('[o2] owner card relay failed, plain fallback:', err.message);
      await sock.sendMessage(m.from, { react: { text: '❌', key: m.key } }).catch(() => {});
      await m.reply(
        `*乂  NEXORA MD  ◦  OWNER*\n\n` +
        `👤 Developer: MOONSON\n` +
        `📞 Number: +${DEV_PHONE}\n` +
        `🌍 Country: Ghana\n` +
        `© 2026 NEXORA MD — All Rights Reserved`
      );
    }
  },
};
