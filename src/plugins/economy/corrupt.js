/**
 * corrupt.js — .corrupt / .corruption / .embezzle — embezzle public funds.
 *
 * Ported from LUNA MD plugins/rpg-bansos.js. Weekly gamble: win a payout,
 * get caught and pay a fine, or walk away clean after bribing your way out.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender); money
 *     (Rp) -> coins, rescaled to the NEXORA economy (win +2,000, fine
 *     -5,000 instead of Rp 2,000,000 / Rp 5,000,000).
 *   - "KPK" (Indonesian anti-corruption commission) -> "Anti-Corruption
 *     Unit"; all strings English, branded NEXORA MD.
 *   - m.chat -> m.from (not needed here — plain m.reply), user record is
 *     the live getUser object; db.save() persists the mutation.
 */
export default {
  name: 'corrupt',
  aliases: ['corruption', 'embezzle'],
  category: 'economy',
  description: 'Embezzle public funds. Weekly — win big, or get caught and pay a fine.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, db }) => {
    try {
      const user = db.getUser(m.sender);
      const rollYou = Math.floor(Math.random() * 101);
      const rollThem = Math.floor(Math.random() * 81);

      const now = Date.now();
      const cooldown = 604800000; // 7 days
      const diff = now - (user.lastbansos ?? 0);

      if (diff < cooldown) {
        return await m.reply(
          `You have already committed financial corruption!\nWait for:\n${clockString(cooldown - diff)}\nSo you do not get caught by the Anti-Corruption Unit.`
        );
      }

      if (rollYou > rollThem) {
        user.coins = Math.max(0, (user.coins ?? 0) - 5000);
        user.lastbansos = now;
        db.save();
        await m.reply('You got caught after you embezzled public funds,\nand you must pay a fine of *5,000 coins* to be freed from prison.');
      } else if (rollYou < rollThem) {
        user.coins = (user.coins ?? 0) + 2000;
        user.lastbansos = now;
        db.save();
        await m.reply('You successfully embezzled public funds!\nYou got *2,000 coins*.');
      } else {
        user.lastbansos = now;
        db.save();
        await m.reply('You did not manage to commit corruption,\nbut you did not go to prison because you *bribed certain parties*.');
      }
    } catch (e) {
      console.error('[corrupt]', e);
      await m.reply('Error');
    }
  },
};

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const min = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', min, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
