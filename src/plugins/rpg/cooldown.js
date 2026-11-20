/**
 * cooldown.js — .cooldown / .cd — show which RPG actions are ready and
 * which are still cooling down.
 *
 * Ported from LUNA MD plugins/rpg-cooldown.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     every timestamp is read with a safe fallback (see DB FIELDS).
 *   - The original's readiness check was broken: it showed ❌ for any
 *     action ever done (`lastX > 0`), because a timestamp is always
 *     > 0 once set. This port compares against each action's real
 *     cooldown and shows the remaining time; actions with no known
 *     cooldown (duel / war / dungeon / mining / bansos / claim /
 *     weekly / monthly — those commands are not in this batch) show
 *     when they were last done instead.
 *   - Added rows for the actions in this batch: chop (3h), scavenge
 *     (30m) and work (24h). The original's `lastberburu` is read as
 *     `lasthunt` — that is the field `hunter` actually writes.
 *   - `m.chat` -> `m.from`; `handler.group = true` dropped (the
 *     NexoraFlex plugin contract has no group-only flag).
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   All are ms timestamps (number, 0 = never done):
 *   lasthunt, lastfishing, lastadventure, lastduel, lastwar,
 *   lastdungeon, lastmining, lastbansos, lastclaim, lastweekly,
 *   lastmonthly, lastnebang, lastmulung, lastnguli
 */

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

function clockString(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return [d > 0 ? `${d}d ` : '', `${h}h `, `${m}m `, `${s}s`].join('').trim();
}

// [label, user field, cooldown ms or null when unknown]
const ACTIONS = [
  ['Hunt', 'lasthunt', 20 * 60 * 1000],
  ['Chop wood', 'lastnebang', 3 * 60 * 60 * 1000],
  ['Scavenge', 'lastmulung', 30 * 60 * 1000],
  ['Adventure', 'lastadventure', 60 * 60 * 1000],
  ['Work', 'lastnguli', 24 * 60 * 60 * 1000],
  ['Fishing', 'lastfishing', null],
  ['Duel', 'lastduel', null],
  ['War', 'lastwar', null],
  ['Dungeon', 'lastdungeon', null],
  ['Mining', 'lastmining', null],
  ['Aid Drop', 'lastbansos', null],
  ['Claim', 'lastclaim', null],
  ['Weekly', 'lastweekly', null],
  ['Monthly', 'lastmonthly', null],
];

export default {
  name: 'cooldown',
  aliases: ['cd'],
  category: 'rpg',
  description: 'Show which RPG actions are ready and which are still cooling down.',
  cooldown: 3000,
  execute: async ({ m, db }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();

    const lines = ACTIONS.map(([label, field, cd]) => {
      const last = num(user, field);
      if (!last) return `*${label}:* ✅ Ready (never done)`;
      if (cd) {
        const remaining = cd - (now - last);
        return remaining > 0
          ? `*${label}:* ⏳ ${clockString(remaining)} left`
          : `*${label}:* ✅ Ready`;
      }
      const ago = clockString(now - last);
      return `*${label}:* 🕓 last done ${ago} ago`;
    });

    await m.reply(`*—「 Cooldown 」—*\n\n${lines.join('\n')}`);
  },
};
