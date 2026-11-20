/**
 * csn.js — .csn <amount|all> — casino points duel against the bot.
 *
 * Ported from LUNA MD plugins/rpg-casino.js (command casino/csn). Named
 * csn because NEXORA MD already ships .bet with aliases gamble/casino
 * (src/plugins/games/bet.js) — this is the separate LUNA points duel.
 *
 * Differences from the LUNA original:
 *   - The per-chat lock lived on conn.casino; here it is a module-level
 *     Set keyed by m.from (same one-game-per-chat rule).
 *   - global.db.data.users[m.sender].exp -> ctx db.getUser(m.sender).xp:
 *     the original staked XP (not money), kept as-is — win pays 2x XP,
 *     a draw refunds the stake. db.save() persists.
 *   - conn.reply / conn.parseMention -> sock.sendMessage with an explicit
 *     mentions array; conn.user.jid -> the fixed "NEXORA MD" bot label.
 *   - m.chat -> m.from; all strings English, branded NEXORA MD.
 */
const activeGames = new Set();

export default {
  name: 'csn',
  aliases: [],
  category: 'games',
  description: 'Casino points duel — stake XP against the bot. Usage: .csn <amount|all>',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, sock, db, args, prefix }) => {
    const p = prefix || '.';
    if (activeGames.has(m.from)) {
      return await m.reply('Someone is still playing casino here, wait until they finish!');
    }
    activeGames.add(m.from);
    if (args.length < 1) {
      activeGames.delete(m.from);
      return await m.reply(`${p}csn <amount>\n${p}csn 1000`);
    }
    try {
      const user = db.getUser(m.sender);
      const botRoll = Math.floor(Math.random() * 101);
      const youRoll = Math.floor(Math.random() * 81); // the house edge, kept from the original
      let count = /all/i.test(args[0]) ? Math.floor(user.xp ?? 0) : parseInt(args[0], 10);
      count = Math.max(1, Number.isFinite(count) ? count : 1);

      if ((user.xp ?? 0) < count) {
        return await m.reply('You do not have enough XP for the casino, please earn some first!');
      }
      user.xp -= count;

      let outcome;
      if (botRoll > youRoll) {
        outcome = '*Lose*\nYou lost ' + count + ' XP';
      } else if (botRoll < youRoll) {
        user.xp += count * 2;
        outcome = '*Win*\nYou won ' + count * 2 + ' XP';
      } else {
        user.xp += count;
        outcome = '*Draw*\nYou got ' + count + ' XP back';
      }
      db.save();

      const caption = `*C A S I N O*\n\n*@${m.sender.split('@')[0]}*\n┗⭑ ${youRoll} Points\n*NEXORA MD*\n┗⭑ ${botRoll} Points\n\n${outcome}`.trim();
      await sock.sendMessage(m.from, { text: caption, mentions: [m.sender] }, { quoted: m });
    } catch (e) {
      console.error('[csn]', e);
      await m.reply('Error!');
    } finally {
      activeGames.delete(m.from);
    }
  },
};
