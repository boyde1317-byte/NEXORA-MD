import { getQuotedStickerHash, addStickerCommand, findByCommand } from '../lib/stickerCommand.js'

    export default {
    name: 'addsticker',
    aliases: ['setsticker'],
    category: 'utility',
    description: 'Map a sticker to a bot command. Reply to a sticker with .addsticker <command>',
    permissions: { owner: true },

    execute: async ({ m, args }) => {
      const commandName = args[0]?.replace(/^\./, '').toLowerCase()

      if (!commandName) {
        return m.reply(
          'Usage: reply to a sticker with *.addsticker <command>*\n' +
          'Example: `.addsticker menu`'
        )
      }

      const hash = getQuotedStickerHash(m)
      if (!hash) {
        return m.reply('\u274c Please *reply to a sticker* to register it.')
      }

      const existing = findByCommand(commandName)
      if (existing) {
        return m.reply(
          `\u274c The command *${commandName}* is already mapped to a sticker.\n` +
          'Use *.delsticker* (reply to that sticker) to remove it first.'
        )
      }

      addStickerCommand(hash, commandName, m.sender)
      await m.reply(
        `\u2705 Sticker registered \u2192 *.${commandName}*\n` +
        'Send that sticker anytime to trigger the command.'
      )
    }
    }
    