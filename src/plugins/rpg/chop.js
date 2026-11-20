/**
 * chop.js — .chop / .chopwood — chop wood in the forest (needs an axe
 * and 20+ stamina, costs 5 axe durability and 20 stamina).
 *
 * Ported from LUNA MD plugins/rpg-nebang.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `money` -> `coins`, `exp` -> `xp`. Every other user field is
 *     read with a safe fallback (see DB FIELDS).
 *   - FIXED the original's broken cooldown check: it read
 *     `if (user.lastnebang > 10800000) throw ...` — comparing a ms
 *     timestamp against 3 hours, which is true forever after the
 *     first chop, so nobody could ever chop twice. The check is now
 *     the real one: `now - lastnebang < 3h` means still exhausted.
 *   - `user.kayu` (wood from chopping) is unified to `wood`, the field
 *     `craft` already uses — the original kept two separate wood
 *     piles that could never be spent together.
 *   - `conn.getName(m.sender)` -> `getDisplayName(sock, m.sender)`
 *     from src/lib/displayName.js; `m.chat` -> `m.from`.
 *   - The staged walk-in animation is kept (one message, edited at
 *     10s / 15s / 20s / 25s, results at ~27s) using
 *     `sock.sendMessage(m.from, { text, edit: key })`, the same edit
 *     mechanism the house ping.js uses. The original's
 *     `conn.reply(hsl, key)` / `m.edit(...)` calls had no NexoraFlex
 *     equivalent.
 *   - `handler.group = true` is dropped — the NexoraFlex plugin
 *     contract has no group-only flag.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - lastnebang (number, 0) — ms timestamp of the last chop
 *   - axe (number, 0) — axes owned (also granted by `verify`)
 *   - axedurability (number, 0) — axe durability (also set by `verify`)
 *   - stamina (number, 100) — current stamina (also used by `eat2`)
 *   - wood (number, 0) — wood (also used by `craft`)
 */

import { getDisplayName } from '../../lib/displayName.js';

const COOLDOWN_MS = 10800000; // 3 hours
const STAMINA_COST = 20;
const DURABILITY_COST = 5;

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default {
  name: 'chop',
  aliases: ['chopwood'],
  category: 'rpg',
  description: 'Chop wood in the forest. Needs an axe and 20+ stamina. 3-hour cooldown.',
  cooldown: 3000,
  execute: async ({ m, sock, db, prefix }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const now = Date.now();
    const name = await getDisplayName(sock, m.sender);

    if (num(user, 'axe') < 1) return m.reply.warn(`You do not have an axe yet — craft one with \`${p}craft axe\` or register with \`${p}verify\`.`);
    if (num(user, 'stamina', 100) < STAMINA_COST) return m.reply.warn(`Your stamina is not enough\nPlease restore your stamina with \`${p}eat2 <dish>\`.`);

    const last = num(user, 'lastnebang');
    if (last > 0 && now - last < COOLDOWN_MS) {
      return m.reply.warn(`You are still exhausted\nPlease wait ${clockString(COOLDOWN_MS - (now - last))} more.`);
    }

    const wood = Math.floor(Math.random() * 300);
    const coins = Math.floor(Math.random() * 3000);
    const xp = Math.floor(Math.random() * 300);

    user.axedurability = Math.max(0, num(user, 'axedurability') - DURABILITY_COST);
    user.stamina = Math.max(0, num(user, 'stamina', 100) - STAMINA_COST);
    user.coins = num(user, 'coins') + coins;
    user.wood = num(user, 'wood') + wood;
    user.xp = num(user, 'xp') + xp;
    user.lastnebang = now;
    db.save();

    const map = `
🚶⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${name}
Looking for an area....`;

    const map2 = `
⬛⬛⬛⬛⬛⬛🚶⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${name}
Almost there....`;

    const map3 = `
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛🚶
🌳🏘️🌳🌳  🌳 🏘️ 🌳🌳🌳

${name}
Starting to chop....`;

    const map4 = `
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
🏘️ 🏘️ 🚶

${name}
Receiving results....`;

    const result =
      `*Chopping Results for ${name}*\n\n` +
      `🪵 Wood: ${wood}\n` +
      `🪙 Coins: ${coins}\n` +
      `✨ XP: ${xp}\n\n` +
      `Your stamina decreased by -${STAMINA_COST}`;

    const sent = await sock.sendMessage(m.from, { text: `${name} Looking for a chopping area.....` }, { quoted: m });
    const key = sent?.key;
    const edit = (text) => { if (key) sock.sendMessage(m.from, { text, edit: key }).catch(() => {}); };
    setTimeout(() => edit(map), 10000);
    setTimeout(() => edit(map2), 15000);
    setTimeout(() => edit(map3), 20000);
    setTimeout(() => edit(map4), 25000);
    setTimeout(() => { sock.sendMessage(m.from, { text: result }, { quoted: m }).catch(() => {}); }, 27000);
  },
};
