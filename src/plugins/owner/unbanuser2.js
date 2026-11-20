/**
 * unbanuser2.js — owner-only user unbanner (second variant).
 *
 *   .unbanuser2 @user   unban a user (or reply to their message)
 *
 * Ported from the LUNA MD owner-unbanuser.js plugin. NexoraFlex already
 * ships .unban (src/plugins/owner/unban.js), so this variant is
 * .unbanuser2 and never shadows it.
 *
 * Differences from the LUNA MD original (luna-md/plugins/owner-unbanuser.js):
 *   - `global.db.data.users[who].banned = false` -> the NexoraFlex db
 *     API: `db.getUser(jid)` / `db.setUser(jid, { banned: false })`.
 *     (Directly assigning into `global.db.data.users[who]` would throw
 *     here when the user has no record yet.)
 *   - Target resolution follows the house unban.js: first mentioned JID,
 *     else the replied-to sender. The LUNA fallback (`m.chat` in DMs)
 *     is dropped — unbanning the chat itself was never the intent.
 *   - Owner gating via `permissions: { owner: true }`; replies when the
 *     user is not banned instead of silently succeeding.
 */
export default {
  name: 'unbanuser2',
  aliases: [],
  category: 'owner',
  description: 'Unban a user. Usage: .unbanuser2 @user (or reply to their message). Owner only.',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, db }) => {
    let targetJid = null;
    if (m.mentioned?.length > 0) targetJid = m.mentioned[0];
    else if (m.quoted?.sender) targetJid = m.quoted.sender;

    if (!targetJid) {
      return await m.reply.error('Usage: `.unbanuser2 @user` — or reply to a user\'s message');
    }

    const user = db.getUser(targetJid);
    if (!user.banned) return await m.reply.error('This user is not banned.');

    db.setUser(targetJid, { banned: false, banReason: null });
    return await m.reply(`✅ Success! ${targetJid.split('@')[0]} has been unbanned.`);
  },
};
