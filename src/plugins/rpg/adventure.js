/**
 * adventure.js — .adventure — go on an adventure, fight something, come
 * back with loot (or bruises).
 *
 * Ported from LUNA MD plugins/rpg-adventure.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `money` -> `coins`, `exp` -> `xp`. Every other user field is read
 *     with a safe fallback (see DB FIELDS below) so the command works
 *     before the central db.js edit lands.
 *   - `m.chat` -> `m.from`; `conn.adReply` (image + caption ad card) is
 *     replaced by a plain image+caption send with a text fallback —
 *     NexoraFlex has no adReply helper.
 *   - The two "rare chest" lines are rendered as real lines instead of
 *     interpolating a JS array (which printed them comma-joined).
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   - lastadventure (number, 0) — ms timestamp of the last adventure
 *   - health (number, 100) — current health; adventure needs >= 80
 *   - potion (number, 0), diamond (number, 0), emerald (number, 0),
 *     trash (number, 0), common (number, 0), uncommon (number, 0),
 *     mythic (number, 0), legendary (number, 0) — loot / crate counts
 */

const COOLDOWN_MS = 3600000; // 1 hour
const MIN_HEALTH = 80;

// Safe numeric read with fallback — the field may not exist in db.js yet.
const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

function makeInt(type, total, maxNumber = 3) {
  if (type === 'anu') return Array.from({ length: total }, (_, i) => i + 1);
  return Array.from({ length: total }, () => Math.floor(Math.random() * maxNumber) + 1);
}

function clockString(ms) {
  const d = isNaN(ms) ? '--' : Math.floor(ms / 86400000);
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000) % 24;
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60;
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

const ADVENTURE_IMAGE = 'https://c4.wallpaperflare.com/wallpaper/755/258/362/action-adventure-anime-chronicles-wallpaper-preview.jpg';

export default {
  name: 'adventure',
  category: 'rpg',
  description: 'Go on an adventure and bring back loot. Needs 80+ health. 1h cooldown.',
  cooldown: 3000,
  execute: async ({ m, sock, db, prefix }) => {
    const p = prefix || '.';
    const user = db.getUser(m.sender);
    const now = Date.now();
    const last = num(user, 'lastadventure');
    const health = num(user, 'health', 100);

    if (health < MIN_HEALTH) {
      return m.reply(
        `You need at least ${MIN_HEALTH} health to go adventuring.\n` +
        `Heal up with a potion (\`${p}heal\`) — buy one first with \`${p}buy potion <amount>\` if you have none.`
      );
    }

    const diff = now - last;
    if (last > 0 && diff < COOLDOWN_MS) {
      return m.reply.warn(`You already went on an adventure — rest for *${clockString(COOLDOWN_MS - diff)}* first.`);
    }

    const healthLost = Math.floor(Math.random() * 101);
    const xp = Math.floor(Math.random() * 10000);
    const coins = Math.floor(Math.random() * 100000);
    const trash = Math.floor(Math.random() * 10000);
    const emerald = Math.floor(Math.random() * 100);

    const potion = pickRandom(makeInt('rand', 3));
    const sampah = pickRandom(makeInt('anu', 50));
    const diamond = pickRandom(makeInt('anu', 10));
    const common = pickRandom(makeInt('anu', 3));
    const uncommon = pickRandom(makeInt('rand', 4));
    const mythic = pickRandom(makeInt('rand', 5, 3));
    const legendary = pickRandom(makeInt('rand', 5, 3));

    const monster = pickRandom(['Giant', 'Bear', 'Tiger', 'Panther', 'Demon']);

    const text =
      `Your health dropped by -${healthLost} — you went adventuring and fought a ${monster}, but you got:\n\n` +
      `✨ *XP:* ${xp.toLocaleString()}\n` +
      `🪙 *Coins:* ${coins.toLocaleString()}\n` +
      `💎 *Diamond:* ${diamond}\n` +
      `💚 *Emerald:* ${emerald}\n` +
      `🗑️ *Trash:* ${sampah}` +
      `${potion ? `\n🧪 *Potion:* ${potion}` : ''}` +
      `${common ? `\n📦 *Common crate:* ${common}` : ''}` +
      `${uncommon ? `\n📦 *Uncommon crate:* ${uncommon}` : ''}` +
      `\n\nAnd you also got:\n` +
      `🎁 *${mythic} Rare Mystic Chest*\n` +
      `🎁 *${legendary} Rare Legendary Chest*`;

    try {
      await sock.sendMessage(m.from, { image: { url: ADVENTURE_IMAGE }, caption: text }, { quoted: m });
    } catch (_) {
      await m.reply(text);
    }

    user.health = Math.max(0, health - healthLost);
    user.xp = num(user, 'xp') + xp;
    user.coins = num(user, 'coins') + coins;
    user.potion = num(user, 'potion') + potion;
    user.diamond = num(user, 'diamond') + diamond;
    user.emerald = num(user, 'emerald') + emerald;
    user.trash = num(user, 'trash') + trash;
    user.common = num(user, 'common') + common;
    user.uncommon = num(user, 'uncommon') + uncommon;
    user.mythic = num(user, 'mythic') + mythic;
    user.legendary = num(user, 'legendary') + legendary;
    user.lastadventure = now;
    db.save();
  },
};
