/**
 * cook2.js — .cook2 <dish> [amount] — cook raw ingredients into meals.
 *
 * Ported from LUNA MD plugins/rpg-cook.js.
 *
 * Why cook2: NexoraFlex already has `.cook` as an alias of
 * src/plugins/general/recipe.js, so the RPG cooker takes `cook2`.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - Dish names are English now (the original used Indonesian dish
 *     names as both the command argument and the stored field). The
 *     mapping is: ayambakar -> grilledchicken, ayamgoreng ->
 *     friedchicken, oporayam -> chickenopor, gulaiayam -> chickencurry,
 *     babipanggang -> roastpork, ikanbakar -> grilledfish, lelebakar ->
 *     grilledcatfish, nilabakar -> grilledtilapia, bawalbakar ->
 *     grilledpomfret, udangbakar -> grilledshrimp, pausbakar ->
 *     grilledwhale, kepitingbakar -> grilledcrab. steak / rendang are
 *     unchanged. Raw ingredients likewise: ayam -> chicken, sapi ->
 *     beef, babi -> pork, ikan -> fish, lele -> catfish, nila ->
 *     tilapia, bawal -> pomfret, udang -> shrimp, paus -> whale,
 *     kepiting -> crab. `eat2` uses the same English dish keys.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     every ingredient/dish count is read with a safe fallback.
 *   - `m.chat` -> `m.from`; the original's stray `m.reply(m.chat, ...)`
 *     (replying with the chat jid as text) is fixed to a plain reply.
 *   - `handler.group = true` is dropped — the NexoraFlex plugin
 *     contract has no group-only flag; the command works anywhere.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   Raw ingredients (number, 0 each): chicken, beef, pork, fish,
 *     catfish, tilapia, pomfret, shrimp, whale, crab, coal
 *   Cooked dishes (number, 0 each): grilledchicken, friedchicken,
 *     chickenopor, chickencurry, steak, rendang, roastpork, grilledfish,
 *     grilledcatfish, grilledtilapia, grilledpomfret, grilledshrimp,
 *     grilledwhale, grilledcrab
 *   NOTE: chicken / pork / beef (cow) also appear as livestock in
 *     `coop` — same fields, shared counts.
 */

// dish -> [raw ingredient field, pretty label]
const RECIPES = {
  grilledchicken: ['chicken', 'Grilled Chicken'],
  friedchicken: ['chicken', 'Fried Chicken'],
  chickenopor: ['chicken', 'Chicken Opor'],
  chickencurry: ['chicken', 'Chicken Curry'],
  steak: ['beef', 'Steak'],
  rendang: ['beef', 'Rendang'],
  roastpork: ['pork', 'Roast Pork'],
  grilledfish: ['fish', 'Grilled Fish'],
  grilledcatfish: ['catfish', 'Grilled Catfish'],
  grilledtilapia: ['tilapia', 'Grilled Tilapia'],
  grilledpomfret: ['pomfret', 'Grilled Pomfret'],
  grilledshrimp: ['shrimp', 'Grilled Shrimp'],
  grilledwhale: ['whale', 'Grilled Whale'],
  grilledcrab: ['crab', 'Grilled Crab'],
};

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function menuText(p) {
  const rows = Object.entries(RECIPES)
    .map(([dish, [ingredient, label]]) => `▧ ${label} (\`${dish}\`) → 2 ${ingredient} + 1 coal`)
    .join('\n');
  return `🍳 *COOK MENU*\n\n${rows}\n\nUsage: \`${p}cook2 <dish> [amount]\`\nExample: \`${p}cook2 grilledchicken 2\``;
}

export default {
  name: 'cook2',
  category: 'rpg',
  description: 'Cook raw ingredients into meals. Usage: .cook2 <dish> [amount]',
  cooldown: 3000,
  execute: async ({ m, args, prefix, db }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const type = (args[0] || '').toLowerCase();
    const count = args[1] ? Math.min(5, Math.max(1, parseInt(args[1], 10) || 1)) : 1;

    if (!type || !(type in RECIPES)) return m.reply(menuText(p));

    const [ingredient, label] = RECIPES[type];
    if (num(user, ingredient) < count * 2 || num(user, 'coal') < count) {
      return m.reply.warn(`❗ Not enough ingredients\nNeed: *${2 * count} ${ingredient}* and *${count} coal*`);
    }

    user[ingredient] = num(user, ingredient) - count * 2;
    user.coal = num(user, 'coal') - count;
    user[type] = num(user, type) + count;
    db.save();

    await m.reply.success(`✅ Successfully cooked *${count} ${label}* 🍽️`);
  },
};
