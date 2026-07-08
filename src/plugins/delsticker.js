import { getQuotedStickerHash, getStickerCommand, deleteStickerCommand } from '../lib/stickerCommand.js'

    export default {
    name: 'delsticker',
    aliases: ['removesticker', 'unsticker'],
    category: 'utility',
    description: 'Remove a sticker → command mapping. Reply to the sticker with .delsticker',
    permissions: { owner: true },

    execute: async ({ m }) => {
      const hash = getQuotedStickerHash(m)
      if (!hash) {
        return m.reply('❌ Please *reply to the sticker* you want to unregister.')
      }

      const entry = getStickerCommand(hash)
      if (!entry) {
        return m.reply('❌ That sticker has no registered command.')
      }

      deleteStickerCommand(hash)
      await m.reply(`✅ Removed sticker mapping for *.${entry.command}*`)
    }
    }
    