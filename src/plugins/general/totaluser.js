/**
 * totaluser.js — .totaluser — user counts from the database.
 *
 * Ported from the LUNA MD info-totaluser plugin
 * (luna-md/plugins/info-totaluser.js). The original counted
 * global.db.data.users and the subset with registered == true.
 * NexoraFlex users have no `registered` field; the closest equivalent
 * is hasOnboarded (set when a user completes onboarding), so
 * "registered" here counts users with hasOnboarded === true.
 */
export default {
  name: 'totaluser',
  aliases: [],
  category: 'general',
  description: 'Show total users in the database and how many completed onboarding.',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const users = db?.data?.users || {};
    const totalreg = Object.keys(users).length;
    const rtotalreg = Object.values(users).filter((user) => user.hasOnboarded === true).length;

    await m.reply(
      `乂 *U S E R*\n\n` +
      `╭╾• *Current Database ${totalreg} User*\n` +
      `=\n` +
      `╰╾• *Onboarded ${rtotalreg} User*`
    );
  },
};
