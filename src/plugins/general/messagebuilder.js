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
 *   .mb galaxy     the menu-19 stack: galaxy bar, opener pair, icons, pill
 *   .mb location   location header + buttons beneath (zapo .location() form)
 *   .mb annotate   sticker annotation (STICKER_ANNOTATION on the command message)
 *   .mb ai         AI Rich: markdown, table, code card, suggestions
 */

import { button, legacyButton, listMessage, airich } from '../../lib/messageBuilder.js';
import { annotateWithSticker } from '../../lib/stickerAnnotation.js';
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

      if (variant === 'galaxy') {
        // The menu-19 techniques, compact: messageParamsJson (galaxy bar +
        // bottom sheet + tap target), the opener pair that unlocks a stack
        // beyond three buttons, section icons/highlight labels, and the
        // forwarded channel pill.
        return await button(sock)
          .body(`» *${name}*\n  › Every trick menu 19 uses, from the builder.`)
          .footer(`© ${name}`)
          .messageParams({
            limited_time_offer: {
              text: name,
              url: 'https://wa.me/233533416608',
              copy_code: prefix,
              expiration_time: Date.now() + 86400000,
            },
            bottom_sheet: { in_thread_buttons_limit: 0, list_title: name, button_title: ' ' },
            tap_target_configuration: {
              title: name,
              description: 'Tap a row below to explore',
              canonical_url: 'https://wa.me/233533416608',
              domain: 'wa.me',
              button_index: 0,
            },
          })
          .multiButtonUnlock()
          .galaxy(`╭───「 ${name} 」───╮`, '.x7')
          .single_select(
            'Menu',
            [
              {
                title: 'Main',
                highlight_label: name,
                rows: [
                  { id: `${prefix}menu`, title: '☰ Menu', description: 'Every command' },
                  { id: `${prefix}ping`, title: '📡 Ping', description: 'Server stats' },
                ],
              },
            ],
            { icon: 'DOCUMENT', multi: true }
          )
          .single_select(
            'Info',
            [{ title: 'Bot', rows: [{ id: `${prefix}owner`, title: '👑 Owner', description: `by ${brand.creator}` }] }],
            { icon: 'REVIEW', multi: true }
          )
          .cta_url('📍 Open in Maps', 'https://maps.google.com/?q=5.6037,-0.187')
          .galaxy('╰────────────────────────╯', `${prefix}menu`)
          .forwarded({ score: 97410 })
          .send(m.from, { quoted: m });
      }

      if (variant === 'location') {
        return await button(sock)
          .title('Location header')
          .body(`» *${name}* — location header\n  › The map sits above the body, buttons beneath it.`)
          .footer(`© ${name}`)
          .location({ latitude: 5.6037, longitude: -0.187, name: `${brand.name} HQ`, address: 'Accra, Ghana' })
          .quick_reply('☰ Menu', `${prefix}menu`)
          .cta_url('📍 Open in Maps', 'https://maps.google.com/?q=5.6037,-0.187')
          .send(m.from, { quoted: m });
      }

      if (variant === 'annotate' || variant === 'sticker') {
        // A sticker tied to this command message via messageAssociation
        // (associationType 11 = STICKER_ANNOTATION). Clients that support the
        // association paint it on the message itself; others show a plain
        // sticker, which is the honest result either way.
        const { imageManager } = await import('../../images/imageManager.js');
        const img = await imageManager.getMenuImage(19);
        if (!img?.buffer) {
          return await m.reply.error?.('No banner image available to build the sticker from.');
        }
        const sent = await annotateWithSticker(sock, m.from, {
          parentKey: m.key,
          image: img.buffer,
          quoted: m,
        });
        console.log('[mb] sticker annotation relayed as', sent?.key?.id);
        return sent;
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
