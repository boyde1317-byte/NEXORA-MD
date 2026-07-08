import { listStickerCommands } from '../lib/stickerCommand.js'

    export default {
    name: 'liststicker',
    aliases: ['stickerlist', 'stickercmds'],
    category: 'utility',
    description: 'Show all registered sticker to command mappings',
    permissions: { owner: true },

    execute: async ({ m }) => {
      const all = listStickerCommands()

      if (all.length === 0) {
        return m.reply(
          'No sticker commands registered yet.\n' +
          'Use *.addsticker <command>* while replying to a sticker.'
        )
      }

      const lines = all.map((e, i) =>
        `${i + 1}. *.${e.command}*\n   Hash: \`${e.shortHash}\`\n   Added by: ${e.addedBy.split('@')[0]}`
      )

      await m.reply(`*Registered Sticker Commands (${all.length})*\n\n${lines.join('\n\n')}`)
    }
    }
    