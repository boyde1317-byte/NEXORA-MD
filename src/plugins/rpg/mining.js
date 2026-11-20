/**
 * mining.js — .mining — swing the pickaxe for ore, gems and XP.
 *
 * Ported from LUNA MD plugins/rpg-mining.js. Named mining (the LUNA
 * command name); NEXORA MD's house command is .mine, so no collision.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender); exp
 *     -> xp. Reward/loss tables are kept as-is (numbers = fixed amounts,
 *     arrays = pick one at random).
 *   - LUNA runtime extensions are reimplemented locally: Number/Array
 *     .getRandom() (the original relied on a patched prototype),
 *     global.rpg.emoticon() (local EMOTICON map), and the
 *     timers.toTimeString() call (local fmtMs).
 *   - The pickaxe gate is dropped: NEXORA MD has no pickaxe item or shop
 *     that sells one, so requiring it would make the command unusable.
 *     Stamina still drains (missing stamina counts as full, 100).
 *   - toRupiah (Rp thousands separators) -> plain toLocaleString.
 *   - m.chat -> m.from (not needed here — plain m.reply).
 */
const COOLDOWN_MS = 300000; // 5 minutes

const EMOTICON = {
  exp: '✨', trash: '🗑️', string: '🧵', rock: '🪨', iron: '🔩',
  emerald: '💚', common: '📦', uncommon: '🔷', mythic: '🔮',
  legendary: '👑', gold: '🥇', diamond: '💎',
  stamina: '⚡', pickaxedurability: '⛏️',
};

export default {
  name: 'mining',
  aliases: [],
  category: 'rpg',
  description: 'Mine for ore, gems and XP. Cooldown: 5 minutes.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, db }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();
    const remaining = COOLDOWN_MS - (now - (user.lastmining ?? 0));

    if ((user.stamina ?? 100) < 20) return await m.reply('You are exhausted.\nHeal first so you can mine.');
    if (now - (user.lastmining ?? 0) <= COOLDOWN_MS) {
      return await m.reply(`You already mined! Wait for *🕐 ${fmtMs(remaining)}*`);
    }

    const rewards = rewardTable();
    let text = 'You mined and got lost';
    for (const lost in rewards.lost) {
      // Missing stamina counts as full (100); other missing fields as 0.
      const current = user[lost] ?? (lost === 'stamina' ? 100 : 0);
      if (current) {
        const total = pickRandom(rewards.lost[lost]);
        user[lost] = Math.max(0, current - total);
        if (total) text += `\n*${EMOTICON[lost] ?? ''}${lost}:* ${total.toLocaleString()}`;
      }
    }
    text += '\n\nBut you got';
    for (const item in rewards.reward) {
      if (item === 'exp' || item in user) {
        const total = pickRandom(rewards.reward[item]);
        if (item === 'exp') user.xp = (user.xp ?? 0) + total;
        else user[item] = (user[item] ?? 0) + total;
        if (total) text += `\n*${EMOTICON[item] ?? ''}${item}:* ${total.toLocaleString()}`;
      }
    }
    user.lastmining = now;
    db.save();

    await m.reply(text);
  },
};

function rewardTable() {
  return {
    reward: {
      exp: 1000,
      trash: 101,
      string: 25,
      rock: 30,
      iron: 25,
      emerald: [1, 4, 0, 0, 3],
      common: [10, 40, 82, 100, 3],
      uncommon: [34, 5, 23, 81],
      mythic: [12, 4, 0, 1, 0],
      legendary: [0, 0, 5, 1, 6, 2, 0, 0],
      gold: [0, 0, 0, 0, 0, 1, 0],
      diamond: [7, 2, 5, 0, 3, 0, 1, 0],
    },
    lost: {
      stamina: 20,
      pickaxedurability: 10,
    },
  };
}

function pickRandom(value) {
  if (Array.isArray(value)) return value[Math.floor(Math.random() * value.length)];
  return value;
}

function fmtMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const s = total % 60;
  return `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
