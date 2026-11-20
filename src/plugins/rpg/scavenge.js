/**
 * scavenge.js — .scavenge — scavenge for bottles, cans and cardboard.
 *
 * Ported from LUNA MD plugins/rpg-mulung.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English
 *     (botol -> bottle, kaleng -> can, kardus -> cardboard).
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     every count/timestamp is read with a safe fallback (see DB FIELDS).
 *   - `m.chat` -> `m.from`; the original threw a plain string on
 *     cooldown — this replies with the wait time instead.
 *   - The 30-minute "time to scavenge again" reminder is kept, sent
 *     via `sock.sendMessage` (the original used `conn.reply`).
 *   - `handler.group = true` is dropped — the NexoraFlex plugin
 *     contract has no group-only flag.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - lastmulung (number, 0) — ms timestamp of the last scavenge
 *   - botol (number, 0) — bottles
 *   - kaleng (number, 0) — cans
 *   - kardus (number, 0) — cardboard
 */

const TIMEOUT_MS = 1800000; // 30 minutes

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function clockString(ms) {
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return `${h}h ${m}m ${s}s`;
}

export default {
  name: 'scavenge',
  category: 'rpg',
  description: 'Scavenge for bottles, cans and cardboard. 30-minute cooldown.',
  cooldown: 3000,
  execute: async ({ m, sock, db }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();
    const last = num(user, 'lastmulung');
    if (last > 0 && now - last < TIMEOUT_MS) {
      return m.reply.warn(`You are too tired to scavenge 😵\nWait *${clockString(TIMEOUT_MS - (now - last))}* more.`);
    }

    const bottles = Math.floor(Math.random() * 100);
    const cans = Math.floor(Math.random() * 40);
    const cardboard = Math.floor(Math.random() * 20);

    user.botol = num(user, 'botol') + bottles;
    user.kaleng = num(user, 'kaleng') + cans;
    user.kardus = num(user, 'kardus') + cardboard;
    user.lastmulung = now;
    db.save();

    await m.reply(
      `*Your Scavenging Results* :\n` +
      `- Bottles : *${bottles}*\n` +
      `- Cardboard : *${cardboard}*\n` +
      `- Cans : *${cans}*`
    );

    setTimeout(() => {
      sock.sendMessage(m.from, { text: '♻️ Time to *scavenge again*!' }, { quoted: m }).catch(() => {});
    }, TIMEOUT_MS);
  },
};
