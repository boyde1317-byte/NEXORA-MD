/**
 * notify.js — .notify — flood a chat with N empty reactions (owner only).
 *
 * Ported from LUNA MD plugins/notify.js. Sends `amount` empty reaction
 * messages to a target chat (default: current chat, or 'here'), spaced
 * `delay` ms apart (default 500).
 *
 * NOTE: mass reactions can trigger WhatsApp spam/ban limits — use sparingly.
 *
 * Differences from the original: `conn` -> `sock`, `m.chat` -> `m.from`;
 * owner gating moved from `handler.owner = true` to the NexoraFlex
 * contract `permissions: { owner: true }`. The `delay` import from
 * 'baileys' is kept. `m.id` -> `m.key?.id` (house serialized messages
 * carry the id on m.key).
 */
import { delay } from 'baileys';

export default {
  name: 'notify',
  aliases: [],
  category: 'owner',
  description: 'Send N empty reactions to a chat. Usage: .notify <amount> [here|<target jid>] [delay ms] (owner only).',
  permissions: { owner: true },
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, commandName }) => {
    const p = prefix || '.';
    const cmd = commandName || 'notify';
    const text = args.join(' ').trim();
    if (!text || !parseInt(args[0], 10)) {
      return await m.reply(`Usage example: *${p + cmd} <amount> <?target> <?delay>*`);
    }

    const [jump, target, dely] = args;
    const much = parseInt(jump, 10);
    const sendto = (target === 'here' ? m.from : target) || m.from;
    const sabar = parseInt(dely, 10) || 500;

    const notif = {
      sessionTransparencyMetadata: {
        disclaimerText: '~ let me know',
        hcaId: `hca_${Date.now()}`,
        sessionTransparencyType: 1,
      },
    };

    const mContextInfo = {
      messageContextInfo: {
        botMetadata: {
          ...notif,
        },
      },
    };

    const reaction = {
      ...mContextInfo,
      reactionMessage: {
        key: {
          remoteJid: sendto,
          id: m.key?.id || m.id,
          fromMe: false,
        },
        text: '',
      },
    };

    await m.react('⏳');

    for (let i = 0; i < much; i++) {
      await sock.relayMessage(
        sendto,
        reaction,
        {
          additionalAttributes: {
            type: 'reaction',
          },
        }
      );

      await delay(sabar);
    }

    await m.react('');
  },
};
