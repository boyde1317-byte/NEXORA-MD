/**
 * fishing.js — .fishing — go fishing and haul in a catch.
 *
 * Ported from LUNA MD plugins/rpg-mancing.js. Named fishing (the LUNA
 * command name); NEXORA MD's house command is .fish, so no collision.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender). Fish
 *     counts (nila, bawal, lele, ikan, udang, paus, kepiting) are extra
 *     fields on the user record, defaulting to 0; db.save() persists.
 *   - conn.getName(m.sender) -> getDisplayName(sock, m.sender).
 *   - The fishing-rod gate is dropped: NEXORA MD has no rod item or shop
 *     that sells one, so requiring it would make the command unusable.
 *     Stamina still gates (missing stamina counts as full, 100).
 *   - Staged replies go through sock.sendMessage, and the waits are
 *     compressed from 8s/28s/38s to 5s/10s — same beats, less dead air.
 *   - m.chat -> m.from; all strings English, branded NEXORA MD.
 */
import { getDisplayName } from '../../lib/displayName.js';

const COOLDOWN_MS = 240000; // 4 minutes
const FISH = [
  ['nila', 'Tilapia'], ['bawal', 'Pomfret'], ['lele', 'Catfish'],
  ['ikan', 'Fish'], ['udang', 'Shrimp'], ['paus', 'Whale'], ['kepiting', 'Crab'],
];

export default {
  name: 'fishing',
  aliases: [],
  category: 'rpg',
  description: 'Go fishing and haul in a catch. Cooldown: 4 minutes.',
  cooldown: 5000,
  execute: async ({ m, sock, db, prefix }) => {
    const user = db.getUser(m.sender);
    const name = await getDisplayName(sock, m.sender);
    const p = prefix || '.';

    try {
      const now = Date.now();
      const diff = now - (user.lastfishing ?? 0);

      if ((user.stamina ?? 100) < 20) {
        return await m.reply(`You do not have enough stamina\nPlease restore your stamina with *${p}eat*`);
      }
      if (diff < COOLDOWN_MS) {
        return await m.reply(`You are still tired\nPlease wait *${clockString(COOLDOWN_MS - diff)}* more`);
      }

      const haul = Object.fromEntries(FISH.map(([key], i) => {
        const max = [10, 10, 15, 30, 39, 2, 27][i];
        return [key, Math.floor(Math.random() * max)];
      }));

      for (const [key] of FISH) user[key] = (user[key] ?? 0) + haul[key];
      user.lastfishing = now;
      db.save();

      const send = (text) => sock.sendMessage(m.from, { text }, { quoted: m }).catch(() => {});
      setTimeout(() => send(`${name} is fishing...`), 0);
      setTimeout(() => send(`${name} is waiting...`), 5000);
      setTimeout(() => send(`${name} — looks like something bit!`), 8000);
      setTimeout(() => {
        const result = `\n*Fishing results for ${name}!*\n\n${FISH.map(([key, label]) => `${label}: ${haul[key]}`).join('\n')}\n\nYou can cook these and eat them\n_Example:_\n${p}cook`.trim();
        send(result);
      }, 10000);
    } catch (e) {
      console.error('[fishing]', e);
      await m.reply('Error');
    }
  },
};

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const min = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', min, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
