/**
 * work.js — .work — claim your daily labor wages (+10 limit).
 *
 * Ported from LUNA MD plugins/rpg-nguli.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     the timestamp and the limit are read with safe fallbacks
 *     (see DB FIELDS).
 *   - `m.chat` -> `m.from`; `handler.group = true` dropped (the
 *     NexoraFlex plugin contract has no group-only flag).
 *   - NOTE: NexoraFlex has no limit system today — `limit` is kept as
 *     a plain user field (+10 per daily claim) so a future limit
 *     system can spend it. Until then the +10 is banked, not spent.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - lastnguli (number, 0) — ms timestamp of the last work claim
 *   - limit (number, 0) — banked command-limit balance
 */

const COOLDOWN_MS = 86400000; // 24 hours
const WAGE = 10;

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

export default {
  name: 'work',
  category: 'rpg',
  description: 'Claim your daily labor wages (+10 limit). Once per day.',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();
    const last = num(user, 'lastnguli');
    if (last > 0 && now - last < COOLDOWN_MS) {
      return m.reply.warn('You already claimed your labor wages today — come back tomorrow.');
    }
    user.limit = num(user, 'limit') + WAGE;
    user.lastnguli = now;
    db.save();
    await m.reply.success(`_Congratulations, you got +${WAGE} limit_ (balance: ${user.limit}).`);
  },
};
