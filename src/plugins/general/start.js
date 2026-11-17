/**
 * @file src/plugins/general/start.js
 *
 * .start — the "Start chatting" card, in the style of the zapo-js bases.
 *
 * The reference screenshot's button turned out to have three plausible wire
 * forms, and only a device can settle which one it is, so all of them are one
 * command away:
 *
 *   .start            cta_url pill opening wa.me with the bot's own number
 *   .start quick      native-flow quick_reply button (sends `start` back)
 *   .start legacy     legacy buttonsMessage RESPONSE button (solid green)
 *   .start contact    a real vCard contact card; WhatsApp paints its own
 *                     green action bar on it
 */

import { sendStartCard, sendStartContact } from '../../lib/startCard.js';
import brand from '../../../config/brand.js';

export default {
  name: 'start',
  aliases: ['hi', 'hello'],
  category: 'general',
  description: 'Start chatting card (card / quick / legacy / contact variants).',
  cooldown: 3000,

  execute: async ({ sock, m, args, prefix = '.' }) => {
    const variant = (args?.[0] || '').toLowerCase();
    const name = brand.display?.name || brand.name;

    const body =
      `» *Hey there* 👋\n` +
      `  › Nice to meet you, I'm ${brand.name}.\n\n` +
      `_Tap below to continue in a private chat._`;

    try {
      if (variant === 'contact') {
        await sendStartContact(sock, m.from, { quoted: m });
        return;
      }

      const kind = variant === 'quick' ? 'quick_reply' : variant === 'legacy' ? 'legacy' : 'cta_url';
      await sendStartCard(sock, m.from, {
        body,
        footer: `© ${name}`,
        label: '💬 Start chatting',
        kind,
        // Tapping the quick reply posts its id; route it to the contact card so
        // one more tap opens the DM (a quick reply cannot open a link itself).
        replyId: `${prefix}start contact`,
        quoted: m,
      });
    } catch (err) {
      console.error('[start] Error:', err);
      await m.reply.error(`Could not send the start card: ${err.message}`);
    }
  },
};
