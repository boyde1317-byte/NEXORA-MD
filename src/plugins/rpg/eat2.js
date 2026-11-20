/**
 * eat2.js — .eat2 <dish> [amount] — eat a cooked meal to restore stamina.
 *
 * Ported from LUNA MD plugins/rpg-eat.js.
 *
 * Why eat2: NexoraFlex already has `.eat` as an alias of
 * src/plugins/fun/food.js, so the RPG eater takes `eat2`.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - Dish names are English now, matching `cook2` (grilledchicken,
 *     friedchicken, chickenopor, chickencurry, steak, rendang,
 *     roastpork, grilledfish, grilledcatfish, grilledtilapia,
 *     grilledpomfret, grilledshrimp, grilledwhale, grilledcrab).
 *   - The original's 14 near-identical switch cases are collapsed into
 *     one table-driven path — same behaviour, same +20 stamina per dish.
 *   - Fixed the original's broken count expression (it referenced
 *     `count` before it was defined and mixed `args[1]`/`args[2]`);
 *     count is now `args[1]`, clamped to 1–99.
 *   - Fixed the original's undeclared `conn` (it called
 *     `conn.reply(...)` without ever receiving `conn` — that would
 *     throw on every eat). All replies go through `m.reply` now.
 *   - Stamina is capped at 100 after eating (the original let it run
 *     past 100 with no cap).
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `handler.register = true` is dropped (NexoraFlex has no
 *     register-gate flag) and `handler.group = true` is dropped (the
 *     NexoraFlex plugin contract has no group-only flag).
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - stamina (number, 100) — current stamina, max 100
 *   - Cooked dishes (number, 0 each): grilledchicken, friedchicken,
 *     chickenopor, chickencurry, steak, rendang, roastpork, grilledfish,
 *     grilledcatfish, grilledtilapia, grilledpomfret, grilledshrimp,
 *     grilledwhale, grilledcrab
 */

// dish -> pretty label (same keys as cook2.js)
const DISHES = {
  grilledchicken: 'Grilled Chicken',
  friedchicken: 'Fried Chicken',
  chickenopor: 'Chicken Opor',
  chickencurry: 'Chicken Curry',
  steak: 'Steak',
  rendang: 'Rendang',
  roastpork: 'Roast Pork',
  grilledfish: 'Grilled Fish',
  grilledcatfish: 'Grilled Catfish',
  grilledtilapia: 'Grilled Tilapia',
  grilledpomfret: 'Grilled Pomfret',
  grilledshrimp: 'Grilled Shrimp',
  grilledwhale: 'Grilled Whale',
  grilledcrab: 'Grilled Crab',
};

const STAMINA_PER_DISH = 20;
const MAX_STAMINA = 100;

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function listText(p) {
  const rows = Object.values(DISHES).map((label) => `│• *${label}*`).join('\n');
  return `╭──『 Food 』\n${rows}\n╰───────────────\n\nUsage: \`${p}eat2 <dish> [amount]\``;
}

export default {
  name: 'eat2',
  category: 'rpg',
  description: 'Eat a cooked meal to restore stamina (+20 each). Usage: .eat2 <dish> [amount]',
  cooldown: 3000,
  execute: async ({ m, args, prefix, db }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const type = (args[0] || '').toLowerCase();

    if (!type || !(type in DISHES)) return m.reply(listText(p));

    const count = args[1] ? Math.min(99, Math.max(1, parseInt(args[1], 10) || 1)) : 1;
    const label = DISHES[type];
    const stamina = num(user, 'stamina', 100);

    if (stamina >= MAX_STAMINA) return m.reply.warn('Your stamina is already full.');
    if (num(user, type) < count) return m.reply.warn(`You do not have enough ${label} (you have ${num(user, type)}).`);

    user[type] = num(user, type) - count;
    user.stamina = Math.min(MAX_STAMINA, stamina + STAMINA_PER_DISH * count);
    db.save();

    await m.reply.success(`Nom nom 🍽️ You ate ${count} ${label} (+${STAMINA_PER_DISH * count} stamina → ${user.stamina}/${MAX_STAMINA}).`);
  },
};
