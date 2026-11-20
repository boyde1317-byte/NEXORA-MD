/**
 * test2.js — .test2 / .allbutton — owner-only test of every native-flow button.
 *
 * Ported from LUNA MD plugins/test2.js. Sends one interactive message
 * carrying every native-flow button type WhatsApp knows (quick reply, CTA
 * URL, webview, copy, call, reminder, location, address, catalog, payment,
 * galaxy, and four single-select lists).
 *
 * Differences from the LUNA original:
 *   - Owner-only via permissions: { owner: true } (LUNA only tagged it
 *     owner; the NEXORA dispatcher enforces it).
 *   - Rebrand LUNA MD -> NEXORA MD; developer 212674375708 -> moonson's
 *     233533416608 everywhere (wa.me, call, copy, payment identifier).
 *   - The WhatsApp channel links are gone (no hardcoded channel links):
 *     the channel CTA / webview / copy rows now point at the public
 *     NexoraFlex GitHub repo.
 *   - Payment block: currency IDR -> USD, reference REMBOT-ALLBTN ->
 *     NEXORA-ALLBTN, beneficiary name -> NEXORA MD.
 *   - messageSecret was a hardcoded base64 string in the original; it is
 *     now crypto.randomBytes(32) fresh per send.
 *   - m.chat -> m.from, conn -> sock.
 */
import crypto from 'crypto';

const DEV_NUMBER = '233533416608';
const REPO_URL = 'https://github.com/boyde1317-byte/NexoraFlex';

export default {
  name: 'test2',
  aliases: ['allbutton'],
  category: 'owner',
  description: 'Owner-only test card carrying every native-flow button type.',
  cooldown: 5000,
  permissions: { owner: true },
  execute: async ({ m, sock }) => {
    await sock.relayMessage(
      m.from,
      {
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
        },
        interactiveMessage: {
          header: { title: 'NEXORA MD - Test All Buttons', subtitle: 'All native-flow types' },
          body: { text: `This is a test of all the WhatsApp buttons that exist, including rare ones that are not widely known yet.\n\n© NEXORA MD - ${DEV_NUMBER}` },
          footer: { text: 'NEXORA MD - All Buttons Complete' },
          nativeFlowMessage: {
            buttons: [
              // === QUICK REPLY ===
              { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ Quick Reply Menu', id: '.menu' }) },
              { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🏓 Quick Reply Ping', id: '.ping' }) },
              { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👑 Quick Reply Owner', id: '.owner' }) },

              // === URL / CTA ===
              { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📢 GitHub Repo', url: REPO_URL, merchant_url: REPO_URL }) },
              { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '👑 Developer', url: `https://wa.me/${DEV_NUMBER}`, merchant_url: `https://wa.me/${DEV_NUMBER}` }) },
              { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🌐 Website', url: 'https://github.com', merchant_url: 'https://github.com' }) },

              // === WEBVIEW ===
              { name: 'open_webview', buttonParamsJson: JSON.stringify({ title: 'Open WebView', link: { in_app_webview: true, url: REPO_URL } }) },

              // === COPY ===
              { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Dev Number', copy_code: `+${DEV_NUMBER}` }) },
              { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Repo', copy_code: REPO_URL }) },
              { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Script', copy_code: 'NEXORA MD' }) },

              // === CALL ===
              { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: '📞 Call Owner', phone_number: `+${DEV_NUMBER}` }) },

              // === REMINDER ===
              { name: 'cta_reminder', buttonParamsJson: JSON.stringify({ display_text: '⏰ Set Reminder' }) },
              { name: 'cta_cancel_reminder', buttonParamsJson: JSON.stringify({ display_text: '❌ Cancel Reminder' }) },

              // === LOCATION & ADDRESS (Rare) ===
              { name: 'send_location', buttonParamsJson: JSON.stringify({}) },
              { name: 'address_message', buttonParamsJson: JSON.stringify({}) },

              // === CATALOG / PRODUCT ===
              { name: 'mpm', buttonParamsJson: JSON.stringify({ product_id: '8816262248471474' }) },
              { name: 'automated_greeting_message_view_catalog', buttonParamsJson: JSON.stringify({ business_phone_number: DEV_NUMBER, catalog_product_id: '8816262248471474' }) },

              // === PAYMENT ===
              { name: 'wa_payment_transaction_details', buttonParamsJson: JSON.stringify({ transaction_id: 'NEXORA123' }) },
              {
                name: 'review_and_pay',
                buttonParamsJson: JSON.stringify({
                  currency: 'USD', payment_type: 'upr',
                  total_amount: { value: 0, offset: 100 },
                  reference_id: 'NEXORA-ALLBTN',
                  type: 'physical-goods',
                  order: { status: 'pending', order_type: 'PAYMENT_REQUEST' },
                  payment_settings: [{ type: 'payment_account', payment_account: { account_type: 'digital_wallet', identifier_type: 'phone_number', identifier_value: `+${DEV_NUMBER}`, institution_name: 'NEXORA MD - Total Features', beneficiary_name: REPO_URL } }],
                }),
              },

              // === GALAXY / DEEPER PAYMENT (Rare Buttons) ===
              { name: 'galaxy', buttonParamsJson: JSON.stringify({}) },

              // === SINGLE SELECT - DEFAULT ===
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '📋 Main Menu',
                  sections: [{
                    title: 'NEXORA MD', highlight_label: 'Main',
                    rows: [
                      { header: 'BOT', title: 'All Menus', description: 'View all commands', id: '.menu' },
                      { header: 'BOT', title: 'Ping Bot', description: 'Check bot speed', id: '.ping' },
                      { header: 'BOT', title: 'Bot Info', description: 'Runtime info', id: '.info' },
                    ],
                  }],
                  icon: 'DEFAULT',
                }),
              },

              // === SINGLE SELECT - REVIEW ===
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '⭐ Tools Menu',
                  sections: [{
                    title: 'Advanced Tools', highlight_label: 'Tools',
                    rows: [
                      { header: 'TOOLS', title: 'To URL', description: 'Upload and get a link', id: '.tourl' },
                      { header: 'TOOLS', title: 'Sticker', description: 'Create a sticker', id: '.s' },
                      { header: 'TOOLS', title: 'To Image', description: 'Convert to image', id: '.toimg' },
                    ],
                  }],
                  icon: 'REVIEW',
                }),
              },

              // === SINGLE SELECT - PROMOTION ===
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '🎁 Promo Menu',
                  sections: [{
                    title: 'NEXORA MD Promo', highlight_label: 'Promo',
                    rows: [
                      { header: 'PROMO', title: 'GitHub Repo', description: 'See the source code', id: '.menu' },
                      { header: 'PROMO', title: 'Contact Dev', description: 'Chat with the developer', id: '.owner' },
                    ],
                  }],
                  icon: 'PROMOTION',
                }),
              },

              // === SINGLE SELECT - DOCUMENT ===
              {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                  title: '📄 Documents Menu',
                  sections: [{
                    title: 'Documentation', highlight_label: 'Docs',
                    rows: [
                      { header: 'DOCS', title: 'Help', description: 'Usage guide', id: '.help' },
                      { header: 'DOCS', title: 'Terms', description: 'Terms & conditions', id: '.rules' },
                    ],
                  }],
                  icon: 'DOCUMENT',
                }),
              },
            ],
            messageParamsJson: JSON.stringify({ limited_time_offer: { text: 'NEXORA MD - Latest Version', url: REPO_URL, copy_code: 'NEXORA MD', expiration_time: 4102444800000 } }),
            messageVersion: 1,
          },
          contextInfo: { expiration: 7776000, disappearingMode: { initiator: 0 } },
        },
      },
      {
        additionalAttributes: { expiration: '7776000' },
        additionalNodes: [{
          tag: 'biz', attrs: {},
          content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }],
        }],
      }
    );
  },
};
