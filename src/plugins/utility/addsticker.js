import { getQuotedStickerHash, addStickerCommand, findByCommand } from '../../lib/stickerCommand.js';
import { withReactionStatus } from '../../lib/cosmetics.js';
import { client } from '../../core/client.js';

export default {
  name: 'addsticker',
  aliases: ['setsticker'],
  category: 'utility',
  description: 'Map a sticker to a bot command. Reply to a sticker with .addsticker <command>',
  permissions: { owner: true },

  execute: async ({ m, args }) => {
    const commandName = args[0]?.replace(/^\./, '').toLowerCase();

    if (!commandName) {
      return m.reply.warn(
        'Usage: reply to a sticker with *.addsticker <command>*\n' +
        'Example: `.addsticker menu`'
      );
    }

    // Only existing, non-owner commands can be sticker shortcuts.
    // A sticker is forwardable and its content hash is stable across
    // re-sends, so mapping an owner-only command would hand a trigger
    // for it to anyone who receives the sticker. The message handler
    // also enforces permissions on sticker triggers, but the mapping
    // itself must never be created. Unknown names are rejected so a
    // typo does not create a dead mapping. Resolve aliases to the
    // canonical command name so one command cannot be mapped twice
    // under two different names.
    const resolvedName = client.aliases.get(commandName) ?? commandName;
    const target = client.commands.get(resolvedName);
    if (!target) {
      return m.reply.error(
        `No command named *${commandName}* exists.\n` +
        'Check the name and try again.'
      );
    }
    const targetPerms = target.permissions || {};
    if (targetPerms.owner ?? target.ownerOnly ?? false) {
      return m.reply.error(
        `*.${target.name}* is owner-only and cannot be mapped to a sticker.\n` +
        'Stickers can be forwarded, so owner commands stay typed-only.'
      );
    }

    const hash = getQuotedStickerHash(m);
    if (!hash) {
      return m.reply.error('Please *reply to a sticker* to register it.');
    }

    const existing = findByCommand(resolvedName);
    if (existing) {
      return m.reply.error(
        `The command *${commandName}* is already mapped to a sticker.\n` +
        'Use *.delsticker* (reply to that sticker) to remove it first.'
      );
    }

    await withReactionStatus(m, async () => {
      addStickerCommand(hash, resolvedName, m.sender);
      await m.reply.success(`Sticker registered → *.${resolvedName}*\nSend that sticker anytime to trigger the command.`);
    });
  }
};
