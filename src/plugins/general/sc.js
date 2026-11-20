/**
 * sc.js — .sc [item name] — sell the bot script (payment request).
 *
 * Ported from the LUNA MD sc plugin (luna-md/plugins/sc.js).
 *
 * PRICE AS WRITTEN IN THE ORIGINAL: 200 MAD (Moroccan dirham), fixed.
 * The payment card charges priceMAD * 100 = 20000 (offset 100), i.e.
 * 200.00 MAD. That price is kept exactly as written; only the bot
 * name is rebranded (LUNA MD -> NEXORA MD).
 *
 * What changed besides the brand:
 *   - Dev phone 212674375708 (old owner, Morocco) -> moonson's
 *     233533416608.
 *   - messageSecret was a hand-rolled random byte array; it is now a
 *     fresh crypto.randomBytes(32) per send.
 *   - The MoPay digital-wallet entry (a Moroccan wallet) is now a
 *     generic 'Mobile Money' entry for the Ghana number.
 *   - PLACEHOLDERS STILL TO FILL — the original shipped with
 *     myPayPal = 'your-paypal@email.com' and myBank = '0'; those are
 *     kept verbatim as clearly-marked placeholders. The card will not
 *     collect a real payment until moonson replaces them with his own
 *     PayPal email and bank account number. Do not ship real money
 *     through this until those two values are set.
 *   - The LUNA 'buy' alias is dropped: only .sc and .script are kept
 *     (the batch spec fixes the aliases to [script]).
 */
import crypto from 'crypto';

const DEV_PHONE = '233533416608';
// ── PLACEHOLDERS — replace with moonson's real details before use ──
const MY_PAYPAL = 'your-paypal@email.com'; // TODO: moonson's PayPal email
const MY_BANK = '0'; // TODO: moonson's bank account number

export default {
  name: 'sc',
  aliases: ['script'],
  category: 'general',
  description: 'Buy the NEXORA MD script — 200 MAD. Usage: .sc [item name]',
  cooldown: 3000,
  execute: async ({ m, sock, args }) => {
    try {
      const itemName = args.join(' ') || 'NEXORA MD - SC';
      const priceMAD = 200; // fixed price, as in the original
      const priceValue = priceMAD * 100;
      const refId = `PAY-${Date.now()}`;

      const paymentJson = {
        currency: 'MAD',
        payment_configuration: '',
        payment_type: 'upr',
        total_amount: { value: priceValue, offset: 100 },
        reference_id: refId,
        type: 'physical-goods',
        order: {
          status: 'pending',
          description: itemName,
          subtotal: { value: priceValue, offset: 100 },
          tax: { value: 0, offset: 100 },
          discount: { value: 0, offset: 100 },
          shipping: { value: 0, offset: 100 },
          order_type: 'PAYMENT_REQUEST',
          items: [{ name: itemName.slice(0, 30), amount: { value: priceValue, offset: 100 }, quantity: 1 }],
        },
        payment_settings: [
          {
            type: 'payment_account',
            payment_account: {
              account_type: 'bank_account',
              identifier_type: 'email',
              identifier_value: MY_PAYPAL,
              institution_name: 'PayPal',
              beneficiary_name: 'moonson',
            },
          },
          {
            type: 'payment_account',
            payment_account: {
              account_type: 'digital_wallet',
              identifier_type: 'phone_number',
              identifier_value: DEV_PHONE,
              institution_name: 'Mobile Money',
              beneficiary_name: 'moonson',
            },
          },
          {
            type: 'payment_account',
            payment_account: {
              account_type: 'bank_account',
              identifier_type: 'id_account_number',
              identifier_value: MY_BANK,
              institution_name: 'Wafacash',
              beneficiary_name: 'moonson',
            },
          },
        ],
        additional_note: itemName,
        native_payment_methods: [],
        share_payment_status: false,
        is_soft_deleted: false,
      };

      await sock.relayMessage(
        m.from,
        {
          messageContextInfo: {
            messageSecret: crypto.randomBytes(32),
          },
          interactiveMessage: {
            header: {
              title: itemName.slice(0, 30),
              subtitle: 'NEXORA MD Store',
              hasMediaAttachment: false,
            },
            body: {
              text: `*${itemName}*\n\n💰 Amount: ${priceMAD} MAD\n\nDev: moonson - NEXORA MD\nSecure payment 💳`,
            },
            footer: { text: 'NEXORA MD - whatsapp-bot' },
            nativeFlowMessage: {
              buttons: [
                {
                  name: 'review_and_pay',
                  buttonParamsJson: JSON.stringify(paymentJson),
                },
              ],
              messageVersion: 1,
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: false,
            },
          },
        },
        {
          additionalNodes: [
            {
              tag: 'biz',
              attrs: {},
              content: [
                {
                  tag: 'interactive',
                  attrs: { type: 'native_flow', v: '1' },
                  content: [
                    { tag: 'native_flow', attrs: { name: 'order_details' } },
                  ],
                },
              ],
            },
          ],
        }
      );
    } catch (e) {
      console.error('[sc]', e);
      await sock.sendMessage(m.from, { text: `❌ Error: ${e.message}` }, { quoted: m });
    }
  },
};
