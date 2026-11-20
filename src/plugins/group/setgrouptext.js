/**
 * setgrouptext.js — .setbye / .setpromote / .setdemote <text> — set the
 * group's custom goodbye / promote / demote messages.
 *
 * Ported from luna-md/plugins/group-setcostum.js. The `setwelcome`
 * branch is DROPPED: NexoraFlex owns that token (owner/setwelcome.js)
 * and welcome text is covered by owner/setwelcometext.js.
 *
 * Storage: the texts live in NEW group fields byeText / promoteText /
 * demoteText via db.getGroup / db.setGroup (default null — field absent
 * until an admin sets it). NOTE: the greeting renderer does not read
 * these fields yet; that wiring is a follow-up, not part of this port.
 *
 * Placeholders in the text (as in the original):
 *   @user    = the tagged user   •   @subject = group name
 *   @desc    = group description
 *
 * Which command was typed is read from `commandName` in the execute
 * context (the dispatcher passes the typed name, alias included).
 */

const FIELD_FOR_COMMAND = {
  setbye: 'byeText',
  setpromote: 'promoteText',
  setdemote: 'demoteText',
};

const LABEL_FOR_COMMAND = {
  setbye: 'Goodbye',
  setpromote: 'Promote',
  setdemote: 'Demote',
};

export default {
  name: 'setbye',
  aliases: ['setpromote', 'setdemote'],
  category: 'group',
  description: 'Set the group\'s custom goodbye, promote or demote message. Usage: .setbye <text> (supports @user, @subject, @desc)',
  permissions: { groupOnly: true, admin: true },
  cooldown: 3000,
  execute: async ({ m, args, prefix, commandName, db }) => {
    const p = prefix || '.';
    const cmd = String(commandName || 'setbye').toLowerCase();
    const field = FIELD_FOR_COMMAND[cmd] || 'byeText';
    const label = LABEL_FOR_COMMAND[cmd] || 'Goodbye';
    const text = args.join(' ').trim();
    if (!text) {
      return await m.reply.error(
        `Where is the text?\n\nExample:\n${p}${cmd} Hi @user\n\n@user = Tagged user\n@subject = Group name\n@desc = Group description`,
      );
    }
    // db.setGroup merges into the stored group record, so other flags
    // (antilink, mute, ...) are untouched.
    db.setGroup(m.from, { [field]: text });
    await m.reply(`✅ ${label} message set successfully:\n${text}`);
  },
};
