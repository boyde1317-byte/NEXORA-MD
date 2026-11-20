/**
 * unbanchat.js — .unbanchat / .ubnc — lift the ban on the current group.
 *
 * Ported from LUNA MD plugins/owner-unbanchat.js. Pair with
 * .banchat (src/plugins/owner/banchat.js) — same notes apply:
 * `global.db.data.chats` -> `db.getGroup` / `db.setGroup`, NexoraFlex
 * has no `chats` table.
 *
 * DB FIELD NEEDED (central edit, not done here): `isBanned` on the group
 * record (boolean, default false) — see banchat.js.
 */
export default {
  name: 'unbanchat',
  aliases: ['ubnc'],
  category: 'owner',
  description: 'Unban this group so it can use the bot again (owner only, group only).',
  permissions: { owner: true, groupOnly: true },
  cooldown: 2000,
  execute: async ({ m, db }) => {
    const group = db.getGroup(m.from);
    if (!group.isBanned) return await m.reply.warn('This group is not banned.');
    db.setGroup(m.from, { isBanned: false });
    return await m.reply.success('Done! This group can use the bot again.');
  },
};
