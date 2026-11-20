/**
 * bet2.js — .bet2 <amount|all> — gamble coins against the bot's roll.
 *
 * Ported from LUNA MD plugins/rpg-bet.js. You roll 0-70, the bot rolls
 * 1-91: beat it to win your stake, lose it to lose your stake, tie for a
 * bonus. Named bet2 because NEXORA MD already ships .bet (flip/dice/slots
 * in src/plugins/games/bet.js).
 *
 * Differences from the LUNA original:
 *   - The yes/no confirmation step is GONE. LUNA used a handler.before
 *     hook to catch the next "yes"/"no" message; the NEXORA plugin
 *     contract has no before-hook, so .bet2 rolls immediately.
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender); money
 *     -> coins; db.save() persists the result.
 *   - m.chat -> m.from (not needed here — plain m.reply).
 */
export default {
  name: 'bet2',
  aliases: [],
  category: 'games',
  description: 'Gamble coins against the bot. Usage: .bet2 <amount|all> — beat the bot roll to win.',
  cooldown: 5000,
  execute: async ({ m, db, args }) => {
    try {
      const user = db.getUser(m.sender);
      const coins = user.coins ?? 0;
      let amount = args[0] && /^\d+$/.test(args[0]) ? Math.max(parseInt(args[0], 10), 1) : /all/i.test(args[0] ?? '') ? Math.floor(coins) : 1;

      if (coins < amount) return await m.reply('You do not have enough coins!');
      if (amount < 1) return await m.reply('Bet at least 1 coin.');

      const bot = Math.ceil(Math.random() * 91);
      const you = Math.floor(Math.random() * 71);

      let status;
      let text;
      if (you > bot) {
        user.coins = coins + amount;
        status = 'Win';
        text = `Won coins amounting to *+${amount}*`;
      } else if (you < bot) {
        user.coins = coins - amount;
        status = 'Lose';
        text = `Lost coins amounting to *-${amount}*`;
      } else {
        const bonus = Math.floor(amount / 1.5);
        user.coins = coins + bonus;
        status = 'Draw';
        text = `Got coins *+${bonus}*`;
      }
      db.save();

      await m.reply(`\n*Bot:* ${bot}\n*You:* ${you}\n\nYou *${status}*, you ${text}\nBalance: ${user.coins} coins`.trim());
    } catch (e) {
      console.error('[bet2]', e);
      await m.reply('An error occurred (cancelled).');
    }
  },
};
