/**
 * delpremuser.js — .delpremuser — remove premium from a user (owner only).
 *
 * Ported from LUNA MD plugins/owner-delprem.js (command `delprem`,
 * `delpremuser`). Behaviour kept: in a group it takes the mentioned user;
 * in a DM it takes the phone number from the text. The target's premium
 * flag is cleared and premiumTime reset to 0.
 *
 * Differences from the original:
 *   - `global.db.data.users` -> ctx `db` (db.data.users for the existence
 *     check, db.setUser() for the write so the change is persisted).
 *   - `conn` -> `sock`, `m.chat` -> `m.from`.
 *   - Owner gating moved from `handler.owner = true` to the NexoraFlex
 *     contract `permissions: { owner: true }` (enforced by the dispatcher).
 */
export default {
  name: 'delpremuser',
  aliases: [], // NOTE: no 'delprem' alias — owner/addprem.js owns .delprem (it handles both add and del; collision fix, 2026-11-20)
  category: 'owner',
  description: 'Remove premium from a user. Usage: .delpremuser <number> (or mention in a group).',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, args, db }) => {
    const text = args.join(' ').trim();
    if (!text && !m.mentionedJid?.length) throw 'Number?';
    let who;
    if (m.isGroup) {
      if (!m.mentionedJid?.length) throw 'No user mentioned.';
      who = m.mentionedJid[0];
    } else {
      const phoneNumber = text.replace(/[^0-9]/g, '');
      if (!phoneNumber) throw 'Number?';
      who = `${phoneNumber}@s.whatsapp.net`;
    }
    // db.getUser() auto-creates a record, so check existence first to
    // keep the original "User not found." behaviour for unknown numbers.
    if (!db.data.users?.[who]) throw 'User not found.';
    db.setUser(who, { premium: false, premiumTime: 0 });
    await m.reply('Done!');
  },
};
