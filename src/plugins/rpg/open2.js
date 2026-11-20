/**
 * open2.js — .open2 <crate> [count] — open loot crates for rewards.
 *
 * Ported from LUNA MD plugins/rpg-open.js.
 *
 * Why open2: NexoraFlex already has `.open` as an alias of
 * src/plugins/group/groupsettings.js, so the crate opener takes
 * `open2`.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `money` -> `coins`, `exp` -> `xp`. Every crate/item count is
 *     read with a safe fallback (see DB FIELDS).
 *   - The original relied on two LUNA globals that do not exist in
 *     NexoraFlex: `rpg.emoticon(v)` and `Array.prototype.getRandom`.
 *     Both are replaced with small locals below (emoji map + a
 *     weighted-pick from the same 0/1 arrays — the reward odds are
 *     unchanged).
 *   - `m.chat` -> `m.from`.
 *   - NOTE: the "buy more crates" hint points at `.buy <crate>`,
 *     which does not exist in NexoraFlex yet — the hint is kept
 *     because it tells the user where crates come from, but there is
 *     currently no way to buy them. Crates today only arrive from
 *     `.adventure` loot.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   Crates (number, 0 each): common, uncommon, mythic, legendary
 *   Crate contents (number, 0 each): trash, potion, diamond, emerald,
 *     gold, iron, wood, rock, string, pet
 */

const REWARDS = {
  common: {
    coins: 101, xp: 201, trash: 11,
    potion: [0, 1, 0, 1, 0, 0, 0, 0, 0],
    common: [0, 1, 0, 1, 0, 0, 0, 0, 0, 0],
    uncommon: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  uncommon: {
    coins: 201, xp: 401, trash: 31,
    potion: [0, 1, 0, 0, 0, 0, 0],
    diamond: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    common: [0, 1, 0, 0, 0, 0, 0, 0],
    uncommon: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    mythic: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    wood: [0, 1, 0, 0, 0, 0],
    rock: [0, 1, 0, 0, 0, 0],
    string: [0, 1, 0, 0, 0, 0],
  },
  mythic: {
    coins: 301, xp: 551, trash: 61,
    potion: [0, 1, 0, 0, 0, 0],
    emerald: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    diamond: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    gold: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    iron: [0, 1, 0, 0, 0, 0, 0, 0],
    common: [0, 1, 0, 0, 0, 0],
    uncommon: [0, 1, 0, 0, 0, 0, 0, 0],
    mythic: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    legendary: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pet: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    wood: [0, 1, 0, 0, 0],
    rock: [0, 1, 0, 0, 0],
    string: [0, 1, 0, 0, 0],
  },
  legendary: {
    coins: 401, xp: 601, trash: 101,
    potion: [0, 1, 0, 0, 0],
    emerald: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    diamond: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    gold: [0, 1, 0, 0, 0, 0, 0, 0],
    iron: [0, 1, 0, 0, 0, 0, 0],
    common: [0, 1, 0, 0],
    uncommon: [0, 1, 0, 0, 0, 0],
    mythic: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    legendary: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    pet: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    wood: [0, 1, 0, 0],
    rock: [0, 1, 0, 0],
    string: [0, 1, 0, 0],
  },
};

const CRATE_EMOJI = { common: '📦', uncommon: '🎁', mythic: '💜', legendary: '👑' };

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

function isNumber(n) {
  if (!n) return false;
  const v = parseInt(n, 10);
  return typeof v === 'number' && !Number.isNaN(v);
}

export default {
  name: 'open2',
  category: 'rpg',
  description: 'Open loot crates for rewards. Usage: .open2 <crate> [count]',
  cooldown: 3000,
  execute: async ({ m, args, prefix, db }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const type = (args[0] || '').toLowerCase();
    const count = Math.floor(isNumber(args[1]) ? Math.min(Math.max(parseInt(args[1], 10), 1), Number.MAX_SAFE_INTEGER) : 1);

    if (!(type in REWARDS)) {
      const rows = Object.keys(REWARDS)
        .map((v) => `${CRATE_EMOJI[v] || '📦'} ${v} — you have ${num(user, v)}`)
        .join('\n');
      return m.reply(
        `Use the format *${p}open2 [crate] [count]*\n` +
        `Example: *${p}open2 common 10*\n\n` +
        `Crate List:\n${rows}`
      );
    }

    if (num(user, type) < count) {
      return m.reply.warn(
        `No crates — you only have ${num(user, type)} *${type} Crate*\n` +
        `Type *${p}buy ${type} ${count - num(user, type)}* to buy more.`
      );
    }

    const crateReward = {};
    for (let i = 0; i < count; i++) {
      for (const [reward, value] of Object.entries(REWARDS[type])) {
        // Fixed rewards (coins/xp/trash) pay out every crate; array
        // rewards pay out only when the random pick lands on 1.
        const total = Array.isArray(value) ? pickRandom(value) : value;
        if (total) {
          user[reward] = num(user, reward) + total;
          crateReward[reward] = (crateReward[reward] || 0) + total;
        }
      }
    }
    user[type] = num(user, type) - count;
    db.save();

    const ordinary = Object.keys(crateReward)
      .filter((v) => v && crateReward[v] && !/legendary|pet|mythic|diamond|emerald/i.test(v))
      .map((reward) => `*${reward}:* ${crateReward[reward]}`)
      .join('\n');

    await m.reply(`You opened *${count}* ${type} Crate(s) and got\n${ordinary}`);

    const { diamond, mythic, pet, legendary, emerald } = crateReward;
    if (mythic || diamond) {
      await m.reply(
        `Congratulations, you got ${diamond ? `*${diamond} Diamond*` : ''}${diamond && mythic ? ' and ' : ''}${mythic ? `*${mythic}* Mythic` : ''}`
      );
    }
    if (pet || legendary || emerald) {
      await m.reply(
        `Congratulations, you got ${pet ? `*${pet}* Pet` : ''}${pet && legendary && emerald ? ', ' : (pet && legendary) || (legendary && emerald) || (emerald && pet) ? ' and ' : ''}${legendary ? `*${legendary}* Legendary` : ''}${pet && legendary && emerald ? ' and ' : ''}${emerald ? `*${emerald}* Emerald` : ''}`
      );
    }
  },
};
