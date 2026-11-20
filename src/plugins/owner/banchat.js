/**
 * banchat.js — .banchat / .bnc — ban the current group from using the bot.
 *
 * Ported from LUNA MD plugins/owner-banchat.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; owner-only + group-only via
 *     `permissions: { owner: true, groupOnly: true }` (the dispatcher
 *     enforces both — the original relied on handler.owner/handler.group).
 *   - `global.db.data.chats[m.chat].isBanned` -> `db.getGroup(m.from)` /
 *     `db.setGroup(m.from, { isBanned: true })` — NexoraFlex has no
 *     `chats` table; groups live under db.data.groups.
 *
 * DB FIELD NEEDED (central edit, not done here): `isBanned` on the group
 * record (boolean, default false). Used with a safe fallback here
 * (setGroup merges it in even before the default exists) — but the
 * dispatcher/handler must also READ it for the ban to take effect.
 * Pair with .unbanchat (src/plugins/owner/unbanchat.js).
 */
export default {
  name: 'banchat',
  aliases: ['bnc'],
  category: 'owner',
  description: 'Ban this group from using the bot (owner only, group only).',
  permissions: { owner: true, groupOnly: true },
  cooldown: 2000,
  execute: async ({ m, db }) => {
    const group = db.getGroup(m.from);
    if (group.isBanned) return await m.reply.warn('This group is already banned.');
    db.setGroup(m.from, { isBanned: true });
    return await m.reply.success('Done! This group is now banned from using the bot.');
  },
};
