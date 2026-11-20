/**
 * banuser2.js — .banuser2 @user — ban a user from the bot.
 *
 * Ported from the LUNA MD owner-banuser plugin
 * (luna-md/plugins/owner-banuser.js). The original set
 * global.db.data.users[who].banned = true, resolving the target from
 * m.mentionedJid[0] in groups or m.chat in DMs, and threw bare strings
 * on missing input. This port:
 *
 *   - Uses the house db: db.getUser(target) then
 *     db.setUser(target, { banned: true }) so the write is persisted.
 *   - Target resolution follows the house owner/ban.js pattern:
 *     m.mentioned[0], else the replied-to sender, else (in a DM) the
 *     sender themselves. Missing target is a plain usage reply, not a
 *     thrown string.
 *   - Adds the self-ban guard the original lacked.
 *
 * Why banuser2 and not banuser: NexoraFlex already ships
 * src/plugins/owner/ban.js (.ban, alias .banuser), so this one stays
 * separate and the existing command is untouched.
 */
export default {
  name: 'banuser2',
  aliases: [],
  category: 'owner',
  description: 'Ban a user from using the bot (owner only). Usage: .banuser2 @user',
  permissions: { owner: true },
  cooldown: 2000,
  execute: async ({ m, db }) => {
    let who = null;
    if (m.mentioned?.length > 0) who = m.mentioned[0];
    else if (m.quoted?.sender) who = m.quoted.sender;
    else if (!m.isGroup) who = m.sender;

    if (!who) {
      return m.reply('Who should be banned? Tag a user or reply to their message.\nUsage: .banuser2 @user');
    }
    if (who === m.sender) {
      return m.reply("You can't ban yourself.");
    }

    const user = db.getUser(who);
    if (user.banned) {
      return m.reply('That user is already banned.');
    }
    db.setUser(who, { banned: true });
    await m.reply(`Success! ${who.split('@')[0]} has been banned from using NEXORA MD.`);
  },
};
