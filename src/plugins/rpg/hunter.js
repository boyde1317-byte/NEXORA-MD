/**
 * hunter.js — .hunter — hunt a random monster for coins, XP and a
 * ticketcoin. Dying costs a level and 5 swords.
 *
 * Ported from LUNA MD plugins/rpg-hunt.js.
 *
 * NOTE: this is NOT NexoraFlex's `.hunt` (src/plugins/rpg/hunt.js,
 * the house factory action). The LUNA monster hunt is a different
 * command with its own 20-minute cooldown, health loss and death
 * penalty, so it ships as `hunter`.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `money` -> `coins`, `exp` -> `xp`. Every other user field is
 *     read with a safe fallback (see DB FIELDS).
 *   - `m.chat` -> `m.from`; mentions go through `sock.sendMessage`
 *     with `mentions: [m.sender]` instead of `conn.parseMention`.
 *   - `handler.limit = true` is dropped — NexoraFlex has no per-command
 *     limit system. `handler.group = true` is dropped (the NexoraFlex
 *     plugin contract has no group-only flag).
 *   - The original threw a plain string on cooldown; this replies with
 *     the wait time instead.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - lasthunt (number, 0) — ms timestamp of the last hunt
 *   - health (number, 100) — current health; hunting can kill you
 *   - sword (number, 0) — swords owned; death costs 5 if level > 0
 *   - tiketcoin (number, 0) — ticket coins earned per successful hunt
 */

const COOLDOWN_MS = 1200000; // 20 minutes

const MONSTERS = [
  { area: 1, name: 'Goblin' }, { area: 1, name: 'Slime' }, { area: 1, name: 'Wolf' },
  { area: 2, name: 'Nymph' }, { area: 2, name: 'Skeleton' }, { area: 2, name: 'Wolf' },
  { area: 3, name: 'Baby Demon' }, { area: 3, name: 'Ghost' }, { area: 3, name: 'Zombie' },
  { area: 4, name: 'Imp' }, { area: 4, name: 'Witch' }, { area: 4, name: 'Zombie' },
  { area: 5, name: 'Ghoul' }, { area: 5, name: 'Giant Scorpion' }, { area: 5, name: 'Unicorn' },
  { area: 6, name: 'Baby Robot' }, { area: 6, name: 'Sorcerer' }, { area: 6, name: 'Unicorn' },
  { area: 7, name: 'Cecaelia' }, { area: 7, name: 'Giant Piranha' }, { area: 7, name: 'Mermaid' },
  { area: 8, name: 'Giant Crocodile' }, { area: 8, name: 'Nereid' }, { area: 8, name: 'Mermaid' },
  { area: 9, name: 'Demon' }, { area: 9, name: 'Harpy' }, { area: 9, name: 'Killer Robot' },
  { area: 10, name: 'Dullahan' }, { area: 10, name: 'Manticore' }, { area: 10, name: 'Killer Robot' },
  { area: 11, name: 'Baby Dragon' }, { area: 11, name: 'Young Dragon' }, { area: 11, name: 'Scaled Baby Dragon' },
  { area: 12, name: 'Kid Dragon' }, { area: 12, name: 'Not so young Dragon' }, { area: 12, name: 'Scaled Kid Dragon' },
  { area: 13, name: 'Definitely not so young Dragon' }, { area: 13, name: 'Teen Dragon' }, { area: 13, name: 'Scaled Teen Dragon' },
];

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default {
  name: 'hunter',
  category: 'rpg',
  description: 'Hunt a random monster for coins, XP and a ticketcoin. 20-minute cooldown.',
  cooldown: 3000,
  execute: async ({ m, sock, db }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();
    const last = num(user, 'lasthunt');
    const remaining = COOLDOWN_MS - (now - last);
    if (last > 0 && remaining > 0) {
      return m.reply.warn(`Wait ${clockString(remaining)} to hunt again.`);
    }

    const monster = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    const monsterName = monster.name.toUpperCase();
    const coins = Math.floor(Math.random() * 100000);
    const xp = Math.floor(Math.random() * 10000);
    const damage = Math.floor(Math.random() * 100);

    user.health = num(user, 'health', 100) - damage;
    user.lasthunt = now;

    if (user.health < 0) {
      let msg = `@${m.sender.split('@')[0]} You were killed by ${monsterName}`;
      if (num(user, 'level') > 0 && num(user, 'sword') > 0) {
        user.level = num(user, 'level') - 1;
        user.sword = Math.max(0, num(user, 'sword') - 5);
        user.xp = Math.max(0, num(user, 'xp') - xp);
        msg += `\nYour level dropped by 1 because you died while hunting!\nYou lost 5 swords because you died while hunting!`;
      }
      user.health = 100;
      db.save();
      return sock.sendMessage(m.from, { text: msg, mentions: [m.sender] }, { quoted: m });
    }

    user.coins = num(user, 'coins') + coins;
    user.xp = num(user, 'xp') + xp;
    user.tiketcoin = num(user, 'tiketcoin') + 1;
    db.save();

    const text =
      `Successfully found *${monsterName}*\n` +
      `@${m.sender.split('@')[0]} You have killed it\n` +
      `You got:\n` +
      `${coins.toLocaleString('en-US')} Coins\n` +
      `${xp.toLocaleString('en-US')} XP\n` +
      `Lost -${damage} Health, ${user.health} Health remaining\n\n` +
      `+1 Ticket Coin`;
    await sock.sendMessage(m.from, { text, mentions: [m.sender] }, { quoted: m });
  },
};
