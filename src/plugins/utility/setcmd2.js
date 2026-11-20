/**
 * setcmd2.js — .setcmd2 <text> — bind an auto-reply text to a sticker.
 *
 * Ported from LUNA MD plugins/cmd-set.js.
 *
 * NexoraFlex already ships .setcmd (src/plugins/group/customcmd.js),
 * but that one maps a sticker to a COMMAND name
 * (db.data.stickerCommands). This variant maps a sticker to a plain
 * TEXT reply (db.data.sticker, read by the _cmdWithMedia hook) — a
 * different store for a different job, so it is .setcmd2 and never
 * shadows the house command. Send the sticker later and the bot
 * replies with the saved text.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`.
 *   - The sticker hash comes from the quoted sticker the same way the
 *     house commands do (fileSha256, mediaKey fallback, base64),
 *     instead of the LUNA-only `m.quoted.fileSha256` Buffer.
 *   - The store is `db.data.sticker` (lazy-created, persisted with
 *     db.save()).
 *   - Errors are plain replies instead of throws.
 */
function hashOf(quoted) {
  const s = quoted?.message?.stickerMessage
    ?? quoted?.message?.documentWithCaptionMessage?.message?.stickerMessage
    ?? quoted?.stickerMessage;
  if (!s) return null;
  const raw = s.fileSha256 ?? s.mediaKey ?? null;
  if (!raw) return null;
  return Buffer.isBuffer(raw) ? raw.toString('base64') : String(raw);
}

function stickerStore(db) {
  if (!db.data.sticker) db.data.sticker = {};
  return db.data.sticker;
}

export default {
  name: 'setcmd2',
  aliases: [],
  category: 'utility',
  description: 'Save an auto-reply text on a sticker. Usage: reply to a sticker with .setcmd2 <text>',
  cooldown: 1500,
  execute: async ({ m, db, args, prefix, commandName }) => {
    const cmd = commandName || 'setcmd2';
    if (!m.quoted) return m.reply(`❌ Reply to a sticker with the command *${prefix}${cmd}*`);
    const hash = hashOf(m.quoted);
    if (!hash) return m.reply('❌ No sticker hash found on that message.');
    const text = (args || []).join(' ').trim();
    if (!text) {
      return m.reply(`Usage:\n${prefix}${cmd} <text>\n\nExample:\n${prefix}${cmd} test`);
    }
    const sticker = stickerStore(db);
    if (sticker[hash] && sticker[hash].locked) {
      return m.reply('❌ You do not have permission to change this sticker reply — it is locked.');
    }
    sticker[hash] = {
      text,
      mentionedJid: m.mentionedJid || [],
      creator: m.sender,
      at: Date.now(),
      locked: false,
    };
    db.save();
    return m.reply('✅ Success! Sticker auto-reply saved.');
  },
};
