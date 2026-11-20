/**
 * menupay.js — .menupay — menu whose body is a review_and_pay payment button.
 *
 * Ported from LUNA MD plugins/menu.js (commands menu/help/?). The command
 * list is built from the live registry (client.commands) grouped by
 * category, like the original built it from global.plugins tags/help.
 *
 * Differences from the original:
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - The payment account was the old dev's phone as a
 *     digital-wallet identifier; it is now moonson's owner number
 *     +233533416608, per the port brief.
 *   - The beneficiary_name was a WhatsApp channel link; channel links
 *     are not carried into NexoraFlex ports, so it is now "NEXORA MD".
 *   - reference_id REMBOT-MENU -> NEXORA-MENU; currency IDR -> USD
 *     (house convention); the quoted order context participant was the
 *     old dev number, now moonson's; the hardcoded messageSecret is now
 *     a fresh crypto.randomBytes(32) per send and the stanzaId is fresh
 *     random hex instead of a fixed string.
 *   - Branding LUNA MD -> NEXORA MD.
 *
 * Why menupay: the `menu` / `help` / `?` names are taken by the house
 * general/menu.js style switcher, so this keeps its own name.
 */
import crypto from 'node:crypto';

const OWNER_NUMBER = '233533416608';

export default {
  name: 'menupay',
  aliases: [],
  category: 'general',
  description: 'Menu listing all categories and commands, with a payment button.',
  cooldown: 3000,
  execute: async ({ m, sock, client }) => {
    const plugins = client?.commands ? [...client.commands.values()] : [];
    const tags = {};
    let total = 0;

    for (const p of plugins) {
      const cat = p.category || 'general';
      if (!tags[cat]) tags[cat] = [];
      tags[cat].push(p.name);
    }

    let footer = '';
    for (const cat in tags) {
      footer += `┌─────┤⁺₊⊹ ${cat.toUpperCase()} ⊹₊⁺├─────┘\n`;
      for (const cmd of tags[cat]) {
        footer += `❖> '.${cmd}\n`;
        total++;
      }
      footer += '\n';
    }
    if (!footer) footer = "❖> '.menupay\n❖> '.ping\n❖> '.owner";

    await sock.relayMessage(
      m.from,
      {
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
        },
        interactiveMessage: {
          body: {
            text: 'All NEXORA MD Category And Commands',
          },
          footer: {
            text: footer.trim(),
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'review_and_pay',
                buttonParamsJson: JSON.stringify({
                  currency: 'USD',
                  payment_type: 'upr',
                  total_amount: { value: 0, offset: 100 },
                  reference_id: 'NEXORA-MENU',
                  type: 'physical-goods',
                  order: { status: 'pending', order_type: 'PAYMENT_REQUEST' },
                  payment_settings: [
                    {
                      type: 'payment_account',
                      payment_account: {
                        account_type: 'digital_wallet',
                        identifier_type: 'phone_number',
                        identifier_value: `+${OWNER_NUMBER}`,
                        institution_name: `NEXORA MD - Total: ${total} Commands`,
                        beneficiary_name: 'NEXORA MD',
                      },
                    },
                  ],
                }),
              },
            ],
            messageVersion: 1,
          },
          contextInfo: {
            stanzaId: crypto.randomBytes(16).toString('hex').toUpperCase(),
            participant: `${OWNER_NUMBER}@s.whatsapp.net`,
            expiration: 7776000,
            disappearingMode: { initiator: 0 },
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
                content: [{ tag: 'native_flow', attrs: { name: 'order_details' } }],
              },
            ],
          },
        ],
      }
    );
  },
};
