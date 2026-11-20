/**
 * angka.js — .angka <0-9> — guess the number, win XP.
 *
 * Ported from LUNA MD plugins/fun-angka.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`.
 *   - `global.db.data.users[m.sender].exp` -> the house user record:
 *     `db.getUser(m.sender).xp` (NexoraFlex tracks `xp`, not `exp`),
 *     persisted with `db.save()`.
 *   - `pickRandom` is a local helper (the LUNA global does not exist
 *     here). The usage string keeps the `#` prefix example from the
 *     original; the real prefix comes from the bot.
 */
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default {
  name: 'angka',
  aliases: [],
  category: 'fun',
  description: 'Guess the number 0-9 and win XP. Usage: .angka 5',
  cooldown: 3000,
  execute: async ({ m, args, db, prefix, commandName }) => {
    const cmd = commandName || 'angka';
    const guess = args[0];
    if (!guess || !DIGITS.includes(guess)) {
      return m.reply(`⚠️ Enter a number between 0 and 9!\nExample: ${prefix}${cmd} 5`);
    }
    const botNumber = pickRandom(DIGITS);
    const correct = guess === botNumber;
    const bonus = correct
      ? Math.floor(Math.random() * 201) + 100
      : Math.floor(Math.random() * 100) + 1;
    const user = db.getUser(m.sender);
    user.xp = (user.xp || 0) + bonus;
    db.save();
    return m.reply(
      `*「 🎲 GUESS THE NUMBER 」*\n\n🎯 Your Number : *${guess}*\n🤖 Bot Number  : *${botNumber}*\n\n${correct ? '✅ Your guess is **CORRECT!**' : '❌ Your guess is **WRONG!**'}\n🎁 You got *+${bonus} XP!*`
    );
  },
};
