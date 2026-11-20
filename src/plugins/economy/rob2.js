/**
 * rob2.js — .rob2 @user — rob another user's coins.
 *
 * Ported from LUNA MD plugins/rpg-merampok.js (command rob). Named rob2
 * because NEXORA MD already ships .rob (src/plugins/economy/rob.js) with
 * its own odds/jail system — this is the separate LUNA flat-amount rob.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users -> ctx db.getUser(jid) for both sides; money
 *     (Rp) -> coins, rescaled to the NEXORA economy (haul up to 1,000,
 *     target needs 100+ coins instead of 100,000 / 10,000).
 *   - m.mentionedJid -> m.msg?.contextInfo?.mentionedJid?.[0] (with
 *     m.mentionedJid as fallback, per house convention in rob.js).
 *   - Throws in the original became plain warning replies (the NEXORA
 *     dispatcher would otherwise answer with a raw error).
 *   - m.chat -> m.from (not needed here — plain m.reply).
 */
const COOLDOWN_MS = 3600000; // 1 hour
const MIN_TARGET_COINS = 100;

export default {
  name: 'rob2',
  aliases: [],
  category: 'economy',
  description: 'Rob a tagged user for coins. Cooldown: 1 hour.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, db }) => {
    const who = m.msg?.contextInfo?.mentionedJid?.[0] || m.mentionedJid?.[0];
    if (!who) return await m.reply.warn('Tag the person you want to rob.');
    if (who === m.sender) return await m.reply.warn('You cannot rob yourself.');

    const users = db.data?.users ?? {};
    if (!users[who]) return await m.reply.warn('That user is not in the database yet.');
    const target = db.getUser(who);
    const user = db.getUser(m.sender);

    const now = Date.now();
    if (now - (user.lastrampok ?? 0) < COOLDOWN_MS) {
      return await m.reply(`You already robbed someone and successfully hid — wait ${clockString(COOLDOWN_MS - (now - (user.lastrampok ?? 0)))} to rob again.`);
    }
    if ((target.coins ?? 0) < MIN_TARGET_COINS) {
      return await m.reply('The person you tagged does not have any coins.\nDo you not feel sorry for them?');
    }

    const haul = Math.floor(Math.random() * 1000);
    const stolen = Math.min(haul, target.coins ?? 0);
    target.coins -= stolen;
    user.coins = (user.coins ?? 0) + stolen;
    user.lastrampok = now;
    db.save();

    await m.reply(`Successfully robbed them — you got ${stolen} coins.`);
  },
};

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const min = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return ['\n' + d, ' *Day*\n ', h, ' *Hour*\n ', min, ' *Minute*\n ', s, ' *Second* '].map((v) => v.toString().padStart(2, 0)).join('');
}
