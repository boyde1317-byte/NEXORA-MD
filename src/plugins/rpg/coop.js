/**
 * coop.js — .coop / .pen — list the animals in your pen.
 *
 * Ported from LUNA MD plugins/rpg-kandang.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English
 *     (animal names translated: banteng -> bull, harimau -> tiger,
 *     gajah -> elephant, kambing -> goat, buaya -> crocodile,
 *     kerbau -> buffalo, sapi -> cow, monyet -> monkey,
 *     babihutan -> wild boar, babi -> pig, ayam -> chicken; panda
 *     is unchanged).
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     every animal count is read with a safe fallback (see DB FIELDS).
 *   - `m.chat` -> `m.from`.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   All animal counts (number, 0 each):
 *   banteng, harimau, gajah, kambing, panda, buaya, kerbau, sapi,
 *   monyet, babihutan, babi, ayam
 *   NOTE: sapi (cow), babi (pig) and ayam (chicken) are shared with
 *     `cook2`'s raw-ingredient fields — same fields, shared counts.
 */

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

// [user field, pretty label]
const ANIMALS = [
  ['banteng', 'Bull'],
  ['harimau', 'Tiger'],
  ['gajah', 'Elephant'],
  ['kambing', 'Goat'],
  ['panda', 'Panda'],
  ['buaya', 'Crocodile'],
  ['kerbau', 'Buffalo'],
  ['sapi', 'Cow'],
  ['monyet', 'Monkey'],
  ['babihutan', 'Wild Boar'],
  ['babi', 'Pig'],
  ['ayam', 'Chicken'],
];

export default {
  name: 'coop',
  aliases: ['pen'],
  category: 'rpg',
  description: 'List the animals in your pen. Usage: .coop',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const user = db.getUser(m.sender);
    const rows = ANIMALS.map(([field, label]) => `• ${label}: ${num(user, field)} head`).join('\n');
    await m.reply(`List of Animals in the Pen\n\n${rows}`);
  },
};
