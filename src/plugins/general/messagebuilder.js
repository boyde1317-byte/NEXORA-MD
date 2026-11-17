/**
 * @file src/plugins/general/messagebuilder.js
 *
 * .mb — demo of src/lib/messageBuilder.js, the chain-method builder ported from
 * KYYDIW's zapo "Message Builder" (MIT © 2026 Ripki Dwi Putra / kyyinfinite).
 *
 *   .mb            nativeFlow card: quick_reply + cta_url + cta_copy
 *   .mb select     single_select picker (the group-safe "list")
 *   .mb legacy     legacy buttonsMessage RESPONSE buttons
 *   .mb list       real listMessage (DMs only, the server rejects it in groups)
 *   .mb ai         AI Rich: markdown, table, code card, suggestions
 */

import { button, legacyButton, listMessage, airich } from '../../lib/messageBuilder.js';
import brand from '../../../config/brand.js';

export default {
  name: 'mb',
  aliases: ['msgbuilder', 'builder'],
  category: 'general',
  description: 'Message builder demo (button / select / legacy / list / ai).',
  cooldown: 3000,

  execute: async ({ sock, m, args, prefix = '.', isGroup }) => {
    const variant = (args?.[0] || 'button').toLowerCase();
    const name = brand.display?.name || brand.name;

    try {
      if (variant === 'select') {
        return await button(sock)
          .body(`» *${name}* — picker\n  › single_select works in groups.`)
          .footer(`© ${name}`)
          .single_select('Open menu', [
            {
              title: 'Main',
              rows: [
                { id: `${prefix}menu`, title: '☰ Menu', description: 'Every command, grouped' },
                { id: `${prefix}ping`, title: '📡 Ping', description: 'Latency + server stats' },
              ],
            },
            {
              title: 'Owner',
              rows: [{ id: `${prefix}credits`, title: '👑 Credits', description: 'Who built this' }],
            },
          ])
          .send(m.from, { quoted: m });
      }

      if (variant === 'legacy') {
        return await legacyButton(sock)
          .body(`» *${name}* — legacy buttons\n  › buttonsMessage RESPONSE.`)
          .footer(`© ${name}`)
          .button(`${prefix}ping`, '📡 Ping')
          .button(`${prefix}menu`, '☰ Menu')
          .send(m.from, { quoted: m });
      }

      if (variant === 'list') {
        if (isGroup) {
          return await m.reply.error?.('`listMessage` is rejected by the server in groups — use `.mb select` there.');
        }
        return await listMessage(sock)
          .title(`${name} — list`)
          .body('Pick a command from the list.')
          .footer(`© ${name}`)
          .buttonText('Open list')
          .section('Main', [
            { id: `${prefix}menu`, title: '☰ Menu', description: 'Every command' },
            { id: `${prefix}ping`, title: '📡 Ping', description: 'Server stats' },
          ])
          .send(m.from, { quoted: m });
      }

      if (variant === 'ai') {
        return await airich(sock)
          .text(`# ${brand.name}\nChain-built rich reply: markdown, a native table and a code card.`)
          .table([['Metric', 'Value'], ['Plugins', '285'], ['Checks', '51']])
          .code('javascript', "await airich(sock).text('# Hi').send(jid)")
          .suggest([`${prefix}menu`, `${prefix}ping`])
          .footer(`© ${name}`)
          .send(m.from, { quoted: m });
      }

      return await button(sock)
        .body(`» *${name}* — built with messageBuilder.js\n  › quick_reply, cta_url, cta_copy in one chain.`)
        .footer(`© ${name}`)
        .quick_reply('📡 Ping', `${prefix}ping`)
        .quick_reply('☰ Menu', `${prefix}menu`)
        .cta_url('💬 Start chatting', 'https://wa.me/233533416608')
        .cta_copy('📋 Copy prefix', prefix)
        .send(m.from, { quoted: m });
    } catch (err) {
      console.error('[mb] Error:', err);
      await m.reply.error?.(`Message builder failed: ${err.message}`);
    }
  },
};
