/**
 * hunting.js — .hunting — hunt wild animals and stock the cage.
 *
 * Ported from LUNA MD plugins/rpg-berburu.js. Rolls 12 animal catches,
 * banks them on the user record, and reports the results in stages.
 *
 * Differences from the LUNA original:
 *   - global.db.data.users[m.sender] -> ctx db.getUser(m.sender). Animal
 *     counts (banteng, harimau, gajah, ...) are extra fields on the user
 *     record, defaulting to 0; db.save() persists them.
 *   - Staged replies go through sock.sendMessage (m.reply on a stale
 *     message object inside long setTimeouts is unreliable).
 *   - ".cage to see the results" -> ".inventory" — NEXORA MD has no .cage
 *     command; the bag lives under .inv / .inventory.
 *   - m.chat -> m.from; all strings English, branded NEXORA MD.
 */
const COOLDOWN_MS = 500000; // ~8 minutes

const ANIMALS = [
  ['banteng', '🐂'], ['harimau', '🐅'], ['gajah', '🐘'], ['kambing', '🐐'],
  ['panda', '🐼'], ['buaya', '🐊'], ['kerbau', '🐃'], ['sapi', '🐮'],
  ['monyet', '🐒'], ['babihutan', '🐗'], ['babi', '🐖'], ['ayam', '🐓'],
];

export default {
  name: 'hunting',
  aliases: [],
  category: 'rpg',
  description: 'Hunt wild animals and stock your bag. Cooldown: ~8 minutes.',
  cooldown: 5000,
  permissions: { groupOnly: true },
  execute: async ({ m, sock, db, prefix }) => {
    const user = db.getUser(m.sender);
    const now = Date.now();
    const diff = now - (user.lastberburu ?? 0);

    if (diff < COOLDOWN_MS) {
      return await m.reply(`*Looks like you are already exhausted*\n*Please rest first for* ${clockString(COOLDOWN_MS - diff)}`);
    }

    const rolls = Array.from({ length: 12 }, () => Math.floor(Math.random() * 9) + 1);
    const result = `Hunting Results\n\n${ANIMALS.map(([key, emoji], i) => `${emoji} ${key}: ${rolls[i]}`).join('\n')}\n\n*Type ${prefix || '.'}inventory to see the results*`;

    ANIMALS.forEach(([key], i) => {
      user[key] = (user[key] ?? 0) + rolls[i];
    });
    user.lastberburu = now;
    db.save();

    const send = (text) => sock.sendMessage(m.from, { text }, { quoted: m }).catch(() => {});
    await m.reply('Looking for prey...');
    setTimeout(() => send('You found prey and are waiting for the right moment to strike.'), 14000);
    setTimeout(() => send('Boom — you duel your prey in the open field.'), 15000);
    setTimeout(() => send('Here it is...\n\nYou won the duel, even though your prey fought back hard.'), 18000);
    setTimeout(() => send(result), 20000);
  },
};

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const min = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return ['\n' + d, ' *Days*\n ', h, ' *Hours*\n ', min, ' *Minutes*\n ', s, ' *Seconds* '].map((v) => v.toString().padStart(2, 0)).join('');
}
