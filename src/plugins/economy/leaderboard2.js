/**
 * leaderboard2.js — .leaderboard2 [count] — XP / Level / Coins top lists.
 *
 * Ported from LUNA MD plugins/rpg-leaderboard.js. Named leaderboard2
 * because NEXORA MD already ships .leaderboard (src/plugins/economy/
 * leaderboard.js) — this is the separate LUNA four-board variant.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users -> ctx db.data.users; money -> coins, exp -> xp.
 *   - The "Limit" board is dropped: NEXORA MD has no limit field.
 *   - The cults3d illustration sendFile is dropped; the boards arrive as
 *     plain text with @mentions (house leaderboard uses rich cards, but
 *     this port keeps the LUNA text layout).
 *   - conn.getName / participants check -> plain @number mentions for
 *     every entry, with the mentions array attached.
 *   - m.chat -> m.from; all strings English, branded NEXORA MD.
 */
export default {
  name: 'leaderboard2',
  aliases: [],
  category: 'economy',
  description: 'Top users by XP, level and coins. Usage: .leaderboard2 [count, max 10]',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, db, args }) => {
    const users = Object.entries(db.data?.users ?? {}).map(([jid, value]) => ({ ...value, jid }));
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const sortedXp = [...users].sort((a, b) => num(b.xp) - num(a.xp));
    const sortedLevel = [...users].sort((a, b) => num(b.level) - num(a.level));
    const sortedCoins = [...users].sort((a, b) => num(b.coins) - num(a.coins));

    const len = args[0] && args[0].length > 0 ? Math.min(10, Math.max(parseInt(args[0], 10) || 10, 1)) : Math.min(10, sortedXp.length);
    const rankOf = (list) => list.findIndex((u) => u.jid === m.sender) + 1;
    const lines = (list, fmt) => list.slice(0, len).map((u, i) => `${i + 1}. @${u.jid.split('@')[0]} ${fmt(u)}`).join('\n');

    const text = `\n• *XP Leaderboard Top ${len}* •\nYou: *${rankOf(sortedXp)}* of *${sortedXp.length}*\n\n${lines(sortedXp, (u) => `*${num(u.xp)} XP*`)}\n\n• *Level Leaderboard Top ${len}* •\nYou: *${rankOf(sortedLevel)}* of *${sortedLevel.length}*\n\n${lines(sortedLevel, (u) => `*Level ${num(u.level)}*`)}\n\n• *Coins Leaderboard Top ${len}* •\nYou: *${rankOf(sortedCoins)}* of *${sortedCoins.length}*\n\n${lines(sortedCoins, (u) => `*${num(u.coins)} Coins*`)}`.trim();

    const mentions = [...new Set([
      ...sortedXp.slice(0, len), ...sortedLevel.slice(0, len), ...sortedCoins.slice(0, len),
    ].map((u) => u.jid))];
    await m.reply(text, { mentions });
  },
};
