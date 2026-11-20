/**
 * afk2.js — .afk2 [reason] — mark yourself away from keyboard.
 *
 * Ported from the LUNA MD main-afk plugin (luna-md/plugins/main-afk.js).
 * The LUNA original wrote user.afk = <timestamp> and user.afkReason =
 * <text> on the raw db row. NexoraFlex already has an AFK system in
 * src/handlers/message.js that reads db.getUser().afk as
 * { active, since, reason } — it announces your return, and tells
 * anyone who mentions or replies to you that you are away. This port
 * writes that exact shape so the house AFK notices pick it up; the
 * LUNA flat fields are not written.
 *
 * Why afk2 and not afk: NexoraFlex already ships src/plugins/utility/
 * afk.js (.afk). This one stays separate so the existing command is
 * untouched.
 */
import { getDisplayName } from '../../lib/displayName.js';

export default {
  name: 'afk2',
  aliases: [],
  category: 'utility',
  description: 'Mark yourself AFK with an optional reason. Usage: .afk2 [reason]',
  cooldown: 2000,
  execute: async ({ m, sock, args, db }) => {
    const reason = args.join(' ').trim();
    db.setUser(m.sender, {
      afk: { active: true, since: Date.now(), reason: reason || 'AFK' },
    });
    const name = await getDisplayName(sock, m.sender);
    await m.reply(`${name} is now AFK${reason ? ': ' + reason : ''}`);
  },
};
