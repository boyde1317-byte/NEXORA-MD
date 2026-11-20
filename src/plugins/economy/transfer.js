/**
 * transfer.js — .transfer / .tf — send coins to another user.
 *
 * Ported from LUNA MD plugins/rpg-mentransfer.js.
 *
 * Differences from the original:
 *   - Coins only. The original let you transfer 13 other RPG items
 *     (money/savings/potion/trash/diamond/crates/string/wood/rock/iron/
 *     limit); those branches are dropped — NexoraFlex's economy is coins.
 *     `transfer money 100 @user` still works: "money"/"coins" is just a
 *     word, the amount always moves coins.
 *   - `global.db.data.users` -> the execute-context `db` (db.data.users).
 *   - `conn.reply(m.chat, ...)` -> `m.reply(...)`; `m.chat` -> `m.from`
 *     is not needed here (no sock calls).
 *   - The original's DevMode error-report-to-owner block and the
 *     `limit` branch's buggy `[m.sender].limit` rollback line are gone.
 *   - English only; usage shows both accepted forms.
 */
export default {
  name: 'transfer',
  aliases: ['tf'],
  category: 'economy',
  description: 'Transfer coins to another user. Usage: .transfer 100 @user',
  cooldown: 3000,
  execute: async ({ m, sock, args, prefix, db }) => {
    const usage = `Example: *${prefix}transfer 100 @user*\n(or *${prefix}transfer coins 100 @user*)`;

    // Accept: transfer 100 @user | transfer coins 100 @user | transfer money 100 @user
    let rest = [...(args || [])];
    if (rest[0] && /^(coins?|money)$/i.test(rest[0])) rest.shift();
    if (rest.length < 2) return m.reply(usage);

    const count = Math.min(9999999, Math.max(parseInt(rest[0], 10) || 0, 1));
    const who =
      m.mentionedJid?.[0] ||
      (rest[1] ? rest[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
    if (!who || who === '@s.whatsapp.net') return m.reply('Tag someone, or type their number!');
    if (who === m.sender) return m.reply('You cannot transfer coins to yourself.');

    const users = db?.data?.users || {};
    const me = users[m.sender] || (users[m.sender] = { coins: 0 });
    const target = users[who] || (users[who] = { coins: 0 });
    me.coins = me.coins || 0;
    target.coins = target.coins || 0;

    if (me.coins < count) {
      return m.reply(`You do not have enough coins to transfer ${count}. Your balance: ${me.coins}.`);
    }
    try {
      me.coins -= count;
      target.coins += count;
      await sock.sendMessage(m.from, {
        text: `Successfully transferred ${count} coins to @${who.split('@')[0]}.`,
        mentions: [who],
      }, { quoted: m });
      return;
    } catch (e) {
      me.coins += count;
      console.error('[transfer]', e);
      return m.reply('Failed to transfer.');
    }
  },
};
