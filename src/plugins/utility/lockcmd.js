/**
 * lockcmd.js — lock or unlock a sticker-to-command binding.
 *
 * .lockcmd    reply to a sticker  → binding is locked (cannot be deleted)
 * .unlockcmd  reply to a sticker  → binding is unlocked again
 *
 * Ported from Rem Bot's cmd-lock.js; the Indonesian replies are gone and the
 * store is our db.data.stickerCommands instead of global.db.data.sticker.
 */
import { db } from '../../database/db.js';

/** fileSha256 is stable across re-sends; mediaKey is the fallback. */
function hashOf(quoted) {
  const s = quoted?.message?.stickerMessage
    ?? quoted?.message?.documentWithCaptionMessage?.message?.stickerMessage
    ?? quoted?.stickerMessage;
  if (!s) return null;
  const raw = s.fileSha256 ?? s.mediaKey ?? null;
  if (!raw) return null;
  return Buffer.isBuffer(raw) ? raw.toString('base64') : String(raw);
}

export default {
  name: 'lockcmd',
  aliases: ['unlockcmd'],
  category: 'utility',
  description: 'Lock or unlock a sticker command. Usage: reply to a sticker with .lockcmd or .unlockcmd',
  cooldown: 1500,
  permissions: { owner: true },
  execute: async ({ m, command }) => {
    const quoted = m.quoted;
    if (!quoted) return await m.reply.error('Reply to the sticker whose binding you want to lock.');
    const hash = hashOf(quoted);
    if (!hash) return await m.reply.error('That message carries no sticker hash.');
    const store = db.data.stickerCommands || (db.data.stickerCommands = {});
    if (!(hash in store)) return await m.reply.error('That sticker is not bound to a command yet.');

    const locked = !/^un/i.test(String(command || 'lockcmd'));
    store[hash].locked = locked;
    await db.write?.();
    return await m.reply.success(`${locked ? 'Locked' : 'Unlocked'} the binding for .${store[hash].text || store[hash].command || 'command'}`);
  },
};
