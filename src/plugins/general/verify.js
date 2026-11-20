/**
 * verify.js — .verify <name>.<age> — register in the NEXORA MD database
 * and claim the RPG starter pack (axe + pickaxe).
 *
 * Ported from LUNA MD plugins/xp-register.js.
 *
 * Why verify: NexoraFlex already has `.register` (owner-only, pairing
 * codes — src/plugins/owner/register.js), so the user-registration
 * command takes the file's own alternative name, `verify`, with alias
 * `reg` (free — the owner command uses `regcomplete`).
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     every field is written/read with a safe fallback (see DB FIELDS).
 *   - `conn.profilePictureUrl(m.sender, 'image', 'buffer')` ->
 *     `sock.profilePictureUrl(m.sender, 'image')` (URL, not buffer —
 *     the picture is only used as a thumbnail if present; the reply
 *     is plain text, not the original's adReply card, which NexoraFlex
 *     has no helper for).
 *   - `m.chat` -> `m.from`; the registered-user count comes from
 *     `db.data.users` instead of the bare global `db`.
 *   - Age limits kept: 12–50.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - registered (boolean, false) — has the user registered
 *   - name (string, '') — display name given at registration
 *   - age (number, 0) — age given at registration
 *   - regTime (number, 0) — ms timestamp of registration
 *   - axe (number, 0) — starter pack: 1 axe
 *   - axedurability (number, 0) — starter pack: 30 durability
 *   - pickaxe (number, 0) — starter pack: 1 pickaxe
 *   - pickaxedurability (number, 0) — starter pack: 40 durability
 */

import { createHash } from 'crypto';

const Reg = /\|?(.*)([.|] *?)([0-9]*)$/i;

export default {
  name: 'verify',
  aliases: ['reg'],
  category: 'general',
  description: 'Register in the bot database and claim the RPG starter pack. Usage: .verify <name>.<age>',
  cooldown: 5000,
  execute: async ({ m, sock, args, prefix, db }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const text = args.join(' ');

    if (user.registered === true) {
      return m.reply.warn(`You have already registered in the database. Want to re-register? Use *${p}unregister* first.`);
    }
    if (!Reg.test(text)) {
      return m.reply.warn(`Enter your Name.Age\nExample: \`${p}verify Alex.17\``);
    }

    const [, name, , ageRaw] = text.match(Reg);
    if (!name || !name.trim()) return m.reply.warn('Name cannot be empty.');
    if (!ageRaw) return m.reply.warn('Age cannot be empty.');
    const age = parseInt(ageRaw, 10);
    if (age > 50) return m.reply.warn('Way too old, seriously.');
    if (age < 12) return m.reply.warn('Sorry — under-12s are not allowed in.');

    user.name = name.trim();
    user.age = age;
    user.regTime = Date.now();
    user.registered = true;
    user.axe = 1;
    user.axedurability = 30;
    user.pickaxe = 1;
    user.pickaxedurability = 40;
    db.save();

    const sn = createHash('md5').update(m.sender).digest('hex');
    const registeredCount = Object.values(db.data.users || {}).filter((v) => v.registered === true).length;

    let pp = null;
    try { pp = await sock.profilePictureUrl(m.sender, 'image'); } catch (_) {}

    const cap =
      `─── USER INFO ───\n` +
      `• Name: ${name.trim()}\n` +
      `• Age: ${age} Years\n` +
      `• Status: Success\n` +
      `• Serial: ${sn}\n\n` +
      `── STARTER PACK ──\n` +
      `• Axe: 1 (30 Durability)\n` +
      `• Pickaxe: 1 (40 Durability)\n\n` +
      `✅ Registration successful — you are user number ${registeredCount}.`;

    if (pp) {
      try {
        await sock.sendMessage(m.from, { image: { url: pp }, caption: cap }, { quoted: m });
        return;
      } catch (_) { /* fall through to text */ }
    }
    await m.reply(cap);
  },
};
