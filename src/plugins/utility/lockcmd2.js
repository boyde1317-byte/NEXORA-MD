/**
 * lockcmd2.js — .lockcmd2 / .unlockcmd2 — lock or unlock a sticker
 * auto-reply text binding so it cannot be changed or deleted.
 *
 * Ported from LUNA MD plugins/cmd-lock.js.
 *
 * NexoraFlex already ships .lockcmd / .unlockcmd
 * (src/plugins/utility/lockcmd.js), but those lock a sticker->COMMAND
 * binding (db.data.stickerCommands). This variant locks a sticker->TEXT
 * auto-reply binding (db.data.sticker, written by .setcmd2) — a
 * different store for a different job, so it is .lockcmd2 / .unlockcmd2
 * and never shadows the house commands.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; the lock/unlock branch comes from
 *     `commandName` (the LUNA regex command does not fit the contract).
 *   - The sticker hash comes from the quoted sticker the same way the
 *     house lockcmd does (fileSha256, mediaKey fallback, base64).
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
  name: 'lockcmd2',
  aliases: ['unlockcmd2'],
  category: 'utility',
  description: 'Lock/unlock a sticker auto-reply. Usage: reply to the sticker with .lockcmd2 or .unlockcmd2',
  cooldown: 1500,
  execute: async ({ m, db, commandName }) => {
    if (!m.quoted) return m.reply('❌ Reply to a sticker!');
    const hash = hashOf(m.quoted);
    if (!hash) return m.reply('❌ No sticker hash found on that message.');
    const sticker = stickerStore(db);
    if (!(hash in sticker)) return m.reply('❌ That sticker has no auto-reply text saved.');
    const lock = !/^un/i.test(commandName || 'lockcmd2');
    sticker[hash].locked = lock;
    db.save();
    return m.reply(lock ? '✅ Done! Sticker auto-reply locked.' : '✅ Done! Sticker auto-reply unlocked.');
  },
};
