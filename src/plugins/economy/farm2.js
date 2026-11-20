/**
 * farm2.js — .farm2 — plant 500 of every seed and harvest fruit.
 *
 * Ported from LUNA MD plugins/rpg-berkebon.js (command garden/farm).
 * Named farm2 because NEXORA MD already ships .farm (the plot garden in
 * src/plugins/economy/farm.js) — this is the separate LUNA seed bulk-plant.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender). Seed
 *     (bibit*) and fruit (apel, mangga, ...) counts are extra fields on
 *     the user record, defaulting to 0; db.save() persists them.
 *   - conn.getName(m.sender) -> getDisplayName(sock, m.sender).
 *   - m.chat -> m.from (not needed here — plain m.reply); the "garden
 *     again" reminder goes through sock.sendMessage.
 *   - NOTE: NEXORA MD's shop does not sell bibit* seeds yet, so this
 *     command is dormant until seeds exist on a user record. The gates
 *     are kept as-is rather than silently granting seeds.
 */
import { getDisplayName } from '../../lib/displayName.js';

const TIMEOUT_MS = 1800000; // 30 minutes
const SEED_COST = 500;
const SEEDS = [
  ['bibitapel', 'apel', 'Apple'],
  ['bibitanggur', 'anggur', 'Grape'],
  ['bibitmangga', 'mangga', 'Mango'],
  ['bibitpisang', 'pisang', 'Banana'],
  ['bibitjeruk', 'jeruk', 'Orange'],
];

export default {
  name: 'farm2',
  aliases: [],
  category: 'economy',
  description: 'Plant 500 of every seed and harvest fruit. Cooldown: 30 minutes.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, sock, db, prefix }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);

    const missing = SEEDS.filter(([seed]) => !(user[seed] ?? 0));
    if (missing.length) {
      return await m.reply(
        `*Make sure you have all the seeds*\n• Apple Seeds\n• Mango Seeds\n• Orange Seeds\n• Banana Seeds\n• Grape Seeds\n\nExample:\n${p}shop buy bibitmangga 500`
      );
    }

    const now = Date.now();
    const readyAt = (user.lastberkebon ?? 0) + TIMEOUT_MS;
    if (now < readyAt) {
      return await m.reply(`\nYou have already planted before.\nWait ${msToTime(readyAt - now)} more.`);
    }

    for (const [seed, , label] of SEEDS) {
      if ((user[seed] ?? 0) < SEED_COST) return await m.reply(`Your ${label} Seeds are less than *${SEED_COST}*`);
    }

    const yields = Object.fromEntries(SEEDS.map(([, fruit]) => [fruit, Math.floor(Math.random() * 500)]));
    for (const [seed, fruit] of SEEDS) {
      user[fruit] = (user[fruit] ?? 0) + yields[fruit];
      user[seed] -= SEED_COST;
    }
    user.tiketcoin = (user.tiketcoin ?? 0) + 1;
    user.lastberkebon = now;
    db.save();

    const name = await getDisplayName(sock, m.sender);
    await m.reply(
      `\nCongratulations ${name}!\nYou got:\n+${yields.pisang} Banana\n+${yields.mangga} Mango\n+${yields.anggur} Grape\n+${yields.jeruk} Orange\n+${yields.apel} Apple\n\n${p}inventory to see your bag.`
    );
    setTimeout(() => {
      sock.sendMessage(m.from, { text: 'Time to garden again 🌱' }, { quoted: m }).catch(() => {});
    }, TIMEOUT_MS);
  },
};

function msToTime(ms) {
  const s = Math.floor((ms / 1000) % 60);
  const min = Math.floor((ms / (1000 * 60)) % 60);
  const h = Math.floor((ms / (1000 * 60 * 60)) % 24);
  return `${h} Hours ${min} Minutes ${s} Seconds`;
}
