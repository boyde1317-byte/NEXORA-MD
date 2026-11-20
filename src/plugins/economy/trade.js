/**
 * trade.js — .trade @user — trade with another user for a shared payout.
 *
 * Ported from LUNA MD plugins/rpg-berdagang.js. Both sides put up capital,
 * then two payouts land 1 hour and 2 hours later.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users -> ctx db.getUser(jid) for both sides; money
 *     (Rp) -> coins, rescaled to the NEXORA economy (capital 500, each
 *     payout +1,500 instead of 5,000 / 15,000).
 *   - m.mentionedJid -> m.msg?.contextInfo?.mentionedJid?.[0] (with
 *     m.mentionedJid as fallback, per house convention in rob.js).
 *   - The delayed payouts re-fetch both users with db.getUser and call
 *     db.save() inside the timer, so a restart-safe record is used; the
 *     timer itself is still in-memory, like the original.
 *   - m.chat -> m.from; mentions sent via sock.sendMessage; all strings
 *     English, branded NEXORA MD.
 */
const COOLDOWN_MS = 28800000; // 8 hours
const CAPITAL = 500;
const PAYOUT = 1500;

export default {
  name: 'trade',
  aliases: [],
  category: 'economy',
  description: 'Trade with a tagged user. Both put up 500 coins; payouts land after 1h and 2h.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, sock, db }) => {
    const who = m.msg?.contextInfo?.mentionedJid?.[0] || m.mentionedJid?.[0];
    if (!who) return await m.reply.warn('Tag someone you want to trade with.');

    const user = db.getUser(m.sender);
    const partner = db.getUser(who);

    const now = Date.now();
    if (now - (user.lastdagang ?? 0) < COOLDOWN_MS) {
      return await m.reply(`You have already traded, wait ${clockString(COOLDOWN_MS - (now - (user.lastdagang ?? 0)))} more.`);
    }
    if ((partner.coins ?? 0) < CAPITAL) return await m.reply.warn(`Target does not have capital, minimum ${CAPITAL} coins.`);
    if ((user.coins ?? 0) < CAPITAL) return await m.reply.warn(`You do not have capital, minimum ${CAPITAL} coins.`);

    partner.coins -= CAPITAL;
    user.coins -= CAPITAL;
    partner.lastdagang = now;
    user.lastdagang = now;
    db.save();

    const tag = `@${who.split('@')[0]}`;
    await sock.sendMessage(m.from, {
      text: `Please wait...\nYou and ${tag} are trading...\nBoth sides put in capital: -${CAPITAL} coins.`,
      mentions: [who],
    }, { quoted: m });

    const pay = (label) => {
      const u = db.getUser(m.sender);
      const p = db.getUser(who);
      u.coins = (u.coins ?? 0) + PAYOUT;
      p.coins = (p.coins ?? 0) + PAYOUT;
      db.save();
      sock.sendMessage(m.from, {
        text: `Congratulations! The ${label} trade result is out.\n\nYou got +${PAYOUT} coins (Total: ${u.coins})\n${tag} got +${PAYOUT} coins (Total: ${p.coins})`,
        mentions: [who],
      }, { quoted: m }).catch(() => {});
    };
    setTimeout(() => pay('first'), 3600000);
    setTimeout(() => pay('second'), 7200000);
  },
};

function clockString(ms) {
  const h = Math.floor(ms / 3600000);
  const min = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return [h, min, s].map((v) => v.toString().padStart(2, 0)).join(':');
}
