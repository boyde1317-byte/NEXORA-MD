/**
 * unregister.js — .unregister <SN> — remove your registration from the
 * NEXORA MD database. The serial number must match the one from
 * `.ceksn` (or the one shown when you registered).
 *
 * Ported from LUNA MD plugins/xp-unregister.js.
 *
 * Differences from the LUNA original:
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`.
 *   - The original threw plain strings on missing/wrong serial; this
 *     replies with the error text instead.
 *   - `handler.register = true` is dropped — NexoraFlex has no
 *     register-gate flag.
 *   - Aliases: `unreg` (free in NexoraFlex).
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - registered (boolean, false) — set to false by this command
 *     (same field `verify` sets to true)
 */

import { createHash } from 'crypto';

export default {
  name: 'unregister',
  aliases: ['unreg'],
  category: 'general',
  description: 'Remove your registration. Usage: .unregister <serial number> (see .ceksn)',
  cooldown: 5000,
  execute: async ({ m, args, db }) => {
    if (!args[0]) return m.reply.error('Serial Number is empty — get yours with `.ceksn`.');
    const user = db.getUser(m.sender);
    const sn = createHash('md5').update(m.sender).digest('hex');
    if (args[0] !== sn) return m.reply.error('Serial Number is wrong.');
    user.registered = false;
    db.save();
    await m.reply.success('```Success Unreg !```');
  },
};
