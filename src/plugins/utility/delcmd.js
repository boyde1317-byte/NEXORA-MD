/**
 * delcmd.js — remove a sticker-to-command binding.
 *
 * Ported from Rem Bot's cmd-del.js. Refuses locked bindings, and unlike the
 * original it names what it removed instead of a bare "Berhasil!".
 */
import { db } from '../../database/db.js';

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
  name: 'delcmd',
  aliases: [],
  category: 'utility',
  description: 'Delete a sticker command. Usage: reply to the sticker with .delcmd',
  cooldown: 1500,
  permissions: { owner: true },
  execute: async ({ m }) => {
    if (!m.quoted) return await m.reply.error('Reply to the sticker whose binding you want to delete.');
    const hash = hashOf(m.quoted);
    if (!hash) return await m.reply.error('That message carries no sticker hash.');
    const store = db.data.stickerCommands || {};
    const entry = store[hash];
    if (!entry) return await m.reply.error('That sticker is not bound to a command.');
    if (entry.locked) return await m.reply.error('That binding is locked. Run .unlockcmd first.');

    delete store[hash];
    await db.write?.();
    return await m.reply.success(`Deleted the binding for .${entry.text || entry.command || 'command'}`);
  },
};
