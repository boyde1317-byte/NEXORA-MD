/**
 * pay.js — .pay <price> | <product> — send a WhatsApp payment request.
 *
 * Ported from the LUNA MD order plugin (luna-md/plugins/order.js).
 * The original sent a review_and_pay native-flow invoice via
 * relayMessage with a hardcoded base64 messageSecret and the
 * retailer id 'rembot_store'. This port:
 *
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - messageSecret is a fresh crypto.randomBytes(32) per send.
 *   - retailer id 'rembot_store' -> 'nexora_store',
 *     reference 'rembot_<ts>' -> 'nexora_<ts>'.
 *   - Bot/store names rebranded to NEXORA MD.
 *   - On relay failure it falls back to a plain-text invoice instead
 *     of throwing.
 *   - The biz additionalNodes block is kept: it is what marks the
 *     message as a payment request on the wire.
 *
 * Why pay and not order: NexoraFlex already ships
 * src/plugins/general/order.js (.order), so this one answers to .pay
 * (alias .payment) and the existing command is untouched. Default
 * price is $13 for 'NEXORA MD Premium', as in the original.
 */
import crypto from 'crypto';

export default {
  name: 'pay',
  aliases: ['payment'],
  category: 'general',
  description: 'Send a payment request invoice. Usage: .pay <price> | <product name>',
  cooldown: 3000,
  execute: async ({ m, sock, args }) => {
    const text = args.join(' ');
    const [harga, nama] = text.split('|');

    const amount = parseInt(harga, 10) || 13;
    const productName = nama?.trim() || 'NEXORA MD Premium';
    const note = 'Thank you for shopping at the NEXORA MD Store';
    const total = amount * 100; // offset 100

    const paymentParams = {
      currency: 'USD',
      total_amount: { value: total, offset: 100 },
      reference_id: `nexora_${Date.now()}`,
      type: 'physical-goods',
      order: {
        status: 'payment_requested',
        subtotal: { value: 0, offset: 100 },
        order_type: 'PAYMENT_REQUEST',
        items: [
          {
            retailer_id: 'nexora_store',
            name: productName,
            amount: { value: total, offset: 100 },
            quantity: 1,
          },
        ],
      },
      additional_note: note,
      native_payment_methods: [],
      share_payment_status: true,
    };

    try {
      await sock.relayMessage(m.from, {
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
        },
        interactiveMessage: {
          body: { text: `🧾 *INVOICE - NEXORA MD*\n\n📦 Product: ${productName}\n💰 Price: $${amount}\n\nTap below for payment details` },
          footer: { text: 'NEXORA MD Official Store' },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'review_and_pay',
                buttonParamsJson: JSON.stringify(paymentParams),
              },
            ],
          },
          contextInfo: {
            expiration: 7776000,
            ephemeralSettingTimestamp: 1,
            disappearingMode: { initiator: 0 },
          },
        },
      }, {
        additionalNodes: [
          {
            tag: 'biz',
            attrs: {},
            content: [
              {
                tag: 'interactive',
                attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { name: 'order_details' } }],
              },
            ],
          },
        ],
      });
    } catch (err) {
      console.warn('[pay] payment relay failed, plain fallback:', err.message);
      await m.reply(
        `🧾 *INVOICE - NEXORA MD*\n\n📦 Product: ${productName}\n💰 Price: $${amount}\n\n` +
        `The interactive payment card could not be delivered — please contact the owner to pay.`
      );
    }
  },
};
