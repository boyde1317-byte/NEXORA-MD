/**
 * listfruits.js — .listfruits — show your fruit warehouse.
 *
 * Ported from LUNA MD plugins/rpg-buah.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`.
 *   - Every fruit count is read with a safe fallback (see DB FIELDS).
 *   - The original ended with "Type .sell to sell" — NexoraFlex's
 *     `.sell` only sells the house RPG resources (hunt/mine/fish loot),
 *     it has no fruit prices, so the line is replaced with an honest
 *     note instead of pointing at a command that would reject the fruit.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - pisang (number, 0) — bananas
 *   - anggur (number, 0) — grapes
 *   - mangga (number, 0) — mangoes
 *   - jeruk (number, 0) — oranges
 *   - apel (number, 0) — apples
 */

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

export default {
  name: 'listfruits',
  category: 'rpg',
  description: 'Show the fruit in your warehouse. Usage: .listfruits',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const user = db.getUser(m.sender);
    const text =
      `[ *YOUR FRUIT WAREHOUSE* ]\n\n` +
      `🍌 ${num(user, 'pisang')} Banana\n` +
      `🍇 ${num(user, 'anggur')} Grape\n` +
      `🥭 ${num(user, 'mangga')} Mango\n` +
      `🍊 ${num(user, 'jeruk')} Orange\n` +
      `🍎 ${num(user, 'apel')} Apple\n\n` +
      `_Fruit sales are not wired up yet — the warehouse is view-only for now._`;
    await m.reply(text);
  },
};
