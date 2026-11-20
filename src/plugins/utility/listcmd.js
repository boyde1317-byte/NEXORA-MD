/**
 * listcmd.js — .listcmd — list every sticker auto-reply text binding.
 *
 * Ported from LUNA MD plugins/cmd-list.js.
 *
 * NexoraFlex has no list command for the sticker->TEXT store
 * (db.data.sticker, written by .setcmd2, read by the _cmdWithMedia
 * hook). The house .liststicker lists sticker->COMMAND bindings
 * (db.data.stickerCommands) — a different store, so there is no clash.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`.
 *   - The store is `db.data.sticker` (lazy-created); an empty store
 *     replies that nothing is saved yet instead of an empty list.
 *   - Mentions are dropped: the stored texts are shown as-is.
 */
export default {
  name: 'listcmd',
  aliases: [],
  category: 'utility',
  description: 'List all sticker auto-reply texts. Usage: .listcmd',
  cooldown: 1500,
  execute: async ({ m, db }) => {
    const sticker = db.data.sticker || {};
    const entries = Object.entries(sticker);
    if (!entries.length) return m.reply('*COMMAND LIST*\n\n_No sticker auto-replies saved yet. Reply to a sticker with .setcmd2 <text> to add one._');
    const lines = entries.map(([key, value], index) =>
      `${index + 1}. ${value.locked ? `(Locked) ${key}` : key} : ${value.text}`);
    return m.reply(`*COMMAND LIST*\n\`\`\`\n${lines.join('\n')}\n\`\`\``.trim());
  },
};
