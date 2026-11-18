/**
 * yonoMenu.js — menu 24, the "receipt card" experiment (YONO BOT layout).
 *
 * Skyler found this menu in the wild (credits: YONO BOT - Developer
 * 212672139914) and asked for it wired in so he can see how it behaves. It is
 * deliberately kept close to the original: one `interactiveMessage` whose only
 * nativeFlow button is `review_and_pay`, so the client paints a payment-request
 * sheet instead of a plain button row, with the whole command listing in
 * `footer.text` drawn as box-drawn category headers.
 *
 *   ┌─────┤⁺₊⊹ GENERAL ⊹₊⁺├─────┘
 *   ❖> '.menu
 *   ❖> '.ping
 *
 * Differences from the pasted original, on purpose:
 *   - a fresh 32-byte messageSecret per message instead of YONO's hardcoded
 *     constant, matching the rest of this bot;
 *   - the payment account's visible beneficiary is the owner username
 *     (`wa.me/@moonson3`), not the phone number;
 *   - a synthetic status@broadcast quote key instead of an unresolvable
 *     A592… stanza;
 *   - if the payment card throws, the menu falls back to plain text so the
 *     command never goes silent.
 *
 * If the client refuses the payment sheet, delete this file and its two lines in
 * src/menu/index.js; nothing else depends on it.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent } from 'baileys';
import brand from '../../../config/brand.js';
import owner from '../../../config/owner.js';

// Display name: the styled brand name when the bot runs under the brand name,
// plain otherwise, so a custom bot name stays exactly as configured.
const displayName = (name) => (name === brand.name && brand.display?.name ? brand.display.name : name);

/** The business stanza that makes the client paint the native-flow sheet. */
const RECEIPT_NODES = [{
  tag: 'biz',
  attrs: {},
  content: [{
    tag: 'interactive',
    attrs: { type: 'native_flow', v: '1' },
    content: [{ tag: 'native_flow', attrs: { name: 'order_details' } }],
  }],
}];

/**
 * The listing that rides in the footer: a box header per category, then one
 * command per line. Returns the text and the command count, which the payment
 * account block prints as "NexoraFlex - Total: N Commands".
 */
export function buildReceiptListing(categories = {}) {
  let footer = '';
  let total = 0;

  for (const cat of Object.keys(categories)) {
    footer += `┌─────┤⁺₊⊹ ${String(cat).toUpperCase()} ⊹₊⁺├─────┘\n`;
    for (const cmd of categories[cat] || []) {
      footer += `❖> '.${cmd.name}\n`;
      total += 1;
    }
    footer += '\n';
  }

  if (!footer) {
    footer = "❖> '.menu\n❖> '.ping\n❖> '.owner";
    total = 3;
  }

  return { footer: footer.trim(), total };
}

/** The interactiveMessage itself, kept pure so it can be checked without a socket. */
export function buildReceiptCard({ categories = {}, botName = '', ownerNumber = '', ownerUsername = '' } = {}) {
  const name = displayName(botName || brand.name);
  const { footer, total } = buildReceiptListing(categories);
  const number = String(ownerNumber || '').replace(/[^0-9]/g, '');

  return {
    messageContextInfo: {
      // r18: the client needs a 32-byte secret to render the card at all.
      messageSecret: crypto.randomBytes(32),
    },
    interactiveMessage: {
      body: { text: `🗼${name} Categories🗼` },
      footer: { text: footer },
      nativeFlowMessage: {
        buttons: [{
          name: 'review_and_pay',
          buttonParamsJson: JSON.stringify({
            currency: 'USD',
            payment_type: 'upr',
            total_amount: { value: 0, offset: 100 },
            reference_id: name,
            type: 'physical-goods',
            order: { status: 'pending', order_type: 'PAYMENT_REQUEST' },
            payment_settings: [{
              type: 'payment_account',
              payment_account: {
                account_type: 'digital_wallet',
                identifier_type: 'phone_number',
                identifier_value: number ? `+${number}` : '',
                institution_name: `${name} - Total: ${total} Commands`,
                beneficiary_name: ownerUsername ? `https://wa.me/@${ownerUsername}` : '',
              },
            }],
          }),
        }],
        messageVersion: 1,
      },
      contextInfo: {
        stanzaId: `BAE5${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        participant: '0@s.whatsapp.net',
        remoteJid: 'status@broadcast',
        expiration: 7776000,
        disappearingMode: { initiator: 0 },
      },
    },
  };
}

export const yonoMenu = {
  id: 24,
  name: 'yonoReceipt',
  description: 'Receipt-style category listing — payment sheet card with every command in the footer',
  supportedMessages: ['interactiveMessage', 'nativeFlowMessage'],

  renderer: async ({ sock, m, menuData }) => {
    const body = buildReceiptCard({
      categories: menuData.categories || {},
      botName: menuData.botName,
      ownerNumber: menuData.ownerNumber,
      ownerUsername: owner.ownerUsername,
    });

    try {
      const generated = generateWAMessageFromContent(m.from, body, {
        ...(sock.user?.id ? { userJid: sock.user.id } : {}),
      });
      await sock.relayMessage(m.from, generated.message, {
        messageId: generated.key.id,
        additionalNodes: RECEIPT_NODES,
      });
      return true;
    } catch (err) {
      // A refused payment sheet must not cost the user their menu.
      console.warn('[MENU yonoReceipt] receipt card failed, falling back to text:', err.message);
      await sock.sendMessage(m.from, { text: buildReceiptListing(menuData.categories || {}).footer }, { quoted: m });
      return true;
    }
  },
};

export default yonoMenu;
