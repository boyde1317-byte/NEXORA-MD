/**
 * delcmd2.js — .delcmd2 — delete a sticker auto-reply text binding.
 *
 * Ported from LUNA MD plugins/cmd-del.js.
 *
 * NexoraFlex already ships .delcmd (src/plugins/utility/delcmd.js), but
 * that one deletes a sticker->COMMAND binding (db.data.stickerCommands).
 * This variant deletes a sticker->TEXT auto-reply binding
 * (db.data.sticker, written by .setcmd2, read by the _cmdWithMedia hook)
 * — a different store for a different job, so it is .delcmd2 and never
 * shadows the house command.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`.
 *   - The sticker hash comes from the quoted sticker the same way the
 *     house delcmd does (fileSha256, mediaKey fallback, base64), instead
 *     of the LUNA-only `m.quoted.fileSha256` Buffer.
 *   - The store is `db.data.sticker` (lazy-created, persisted with
 *     db.save()), the same store the _cmdWithMedia hook reads.
 *   - Errors are plain replies instead of throws, so the user sees what
 *     happened instead of a dispatcher error.
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
  name: 'delcmd2',
  aliases: [],
  category: 'utility',
  description: 'Delete a sticker auto-reply text. Usage: reply to the sticker with .delcmd2',
  cooldown: 1500,
  execute: async ({ m, db }) => {
    if (!m.quoted) return m.reply('❌ Reply to the sticker whose auto-reply you want to delete.');
    const hash = hashOf(m.quoted);
    if (!hash) return m.reply('❌ No sticker hash found on that message.');
    const sticker = stickerStore(db);
    if (sticker[hash] && sticker[hash].locked) {
      return m.reply('❌ You do not have permission to delete this sticker reply — it is locked. Run .unlockcmd2 first.');
    }
    if (!sticker[hash]) return m.reply('❌ That sticker has no auto-reply text saved.');
    delete sticker[hash];
    db.save();
    return m.reply('✅ Success! Sticker auto-reply deleted.');
  },
};
