/**
 * monthly.js — .monthly — claim the monthly reward (coins + XP).
 *
 * Ported from LUNA MD plugins/rpg-reward.js.
 *
 * Differences from the original:
 *   - Monthly only. The original also served daily/weekly (`daily`,
 *     `claim`, `weekly`); those are NOT ported — NexoraFlex already has
 *     its own daily reward, so this file is just the monthly tier.
 *   - `user.exp` -> `user.xp`, `user.money` -> `user.coins` (NexoraFlex
 *     field names). The `limit` part of the reward is dropped — NexoraFlex
 *     has no `limit` user field.
 *   - `isPrems` -> the user record's `premium` flag from ctx `db`.
 *   - `global.db.data.users` -> the execute-context `db`.
 *   - DB NOTE: this needs a `lastmonthly` field (default null) on the
 *     user record in src/database/db.js — the staged db.js edit adds it.
 *     Until that edit lands, `user.lastmonthly` is undefined and
 *     `undefined + cooldown - now` is NaN, so the cooldown check is
 *     skipped and the reward can be claimed repeatedly. Ship with db.js.
 */
const MONTHLY_COOLDOWN = 2592000000; // 30 days
const FREE_REWARD = { xp: 4999, coins: 50000 };
const PREM_REWARD = { xp: 5999, coins: 100000 };

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const min = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h} Hours ${min} Minutes ${s} Seconds`;
}

export default {
  name: 'monthly',
  aliases: [],
  category: 'economy',
  description: 'Claim your monthly reward (coins + XP). Premium users get more.',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const users = db?.data?.users || {};
    const user = users[m.sender] || (users[m.sender] = { xp: 0, coins: 0, premium: false });
    user.xp = user.xp || 0;
    user.coins = user.coins || 0;

    const now = Date.now();
    const remaining = (user.lastmonthly || 0) + MONTHLY_COOLDOWN - now;
    if (remaining > 0) {
      return m.reply(`⏳ You already claimed your *monthly* reward.\nWait *${formatTime(remaining)}* more.`);
    }

    const reward = user.premium ? PREM_REWARD : FREE_REWARD;
    user.xp += reward.xp;
    user.coins += reward.coins;
    user.lastmonthly = now;

    return m.reply(
      `🎁 *Monthly Reward*\n\n+ ${reward.xp} XP\n+ ${reward.coins} Coins`
    );
  },
};
