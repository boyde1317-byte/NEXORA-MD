/**
 * craft.js — .craft <item> — craft tools and gear from raw materials.
 *
 * Ported from LUNA MD plugins/rpg-craft.js.
 *
 * Differences from the LUNA original:
 *   - Rebranded LUNA MD -> NEXORA MD; all user-facing strings in English.
 *   - `global.db.data.users[m.sender]` -> ctx `db.getUser(m.sender)`;
 *     `money` -> `coins`. Every material/tool count is read with a
 *     safe fallback (see DB FIELDS).
 *   - Fixed two copy-paste bugs in the original: the `sword` case
 *     checked `user.axe` ("You already have a Sword!") and the `axe`
 *     case checked `user.sword` ("You already have a Sword!") — each
 *     now checks its own tool.
 *   - `m.chat` -> `m.from`.
 *
 * DB FIELDS (missing in NexoraFlex db.js — needed by the central edit):
 *   Materials (number, 0 each): wood, rock, iron, string, emerald,
 *     diamond
 *   Tools (number, 0 each) + durability (number, 0 each):
 *     pickaxe / pickaxedurability, sword / sworddurability,
 *     axe / axedurability, fishingrod / fishingroddurability,
 *     armor / armordurability
 *   ATM (number, 0 each): atm, fullatm (ATM capacity; the original
 *     sets fullatm = 5000000 when an ATM is crafted)
 */

const num = (u, k, d = 0) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? u[k] : d);

const CRAFT_LIST = `
❏ *CRAFT LIST*

• Pickaxe
  - 10 Wood
  - 5 Rock
  - 5 Iron
  - 20 String

• Sword
  - 10 Wood
  - 15 Iron

• Axe
  - 5 Wood
  - 10 Iron

• Fishingrod
  - 10 Wood
  - 2 Iron
  - 20 String

• Armor
  - 30 Iron
  - 1 Emerald
  - 5 Diamond

• ATM
  - 3 Emerald
  - 6 Diamond
  - 10,000 Coins

Example:
.craft sword
`.trim();

export default {
  name: 'craft',
  category: 'rpg',
  description: 'Craft tools and gear from raw materials. Usage: .craft <item>',
  cooldown: 3000,
  execute: async ({ m, args, db }) => {
    const user = db.getUser(m.sender);
    const type = (args[0] || '').toLowerCase();
    if (!type) return m.reply(CRAFT_LIST);

    const need = (msg) => m.reply.warn(msg);
    const done = (msg) => m.reply.success(msg);

    switch (type) {
      case 'pickaxe': {
        if (num(user, 'pickaxe') > 0) return need('You already have a Pickaxe!');
        if (num(user, 'wood') < 10 || num(user, 'rock') < 5 || num(user, 'iron') < 5 || num(user, 'string') < 20)
          return need('Not enough materials!\nRequires: 10 Wood, 5 Rock, 5 Iron, 20 String');
        user.wood = num(user, 'wood') - 10;
        user.rock = num(user, 'rock') - 5;
        user.iron = num(user, 'iron') - 5;
        user.string = num(user, 'string') - 20;
        user.pickaxe = 1;
        user.pickaxedurability = 40;
        db.save();
        return done('Successfully crafted 1 Pickaxe! ⛏️');
      }
      case 'sword': {
        if (num(user, 'sword') > 0) return need('You already have a Sword!');
        if (num(user, 'wood') < 10 || num(user, 'iron') < 15)
          return need('Not enough materials!\nRequires: 10 Wood, 15 Iron');
        user.wood = num(user, 'wood') - 10;
        user.iron = num(user, 'iron') - 15;
        user.sword = 1;
        user.sworddurability = 40;
        db.save();
        return done('Successfully crafted 1 Sword! ⚔️');
      }
      case 'axe': {
        if (num(user, 'axe') > 0) return need('You already have an Axe!');
        if (num(user, 'wood') < 5 || num(user, 'iron') < 10)
          return need('Not enough materials!\nRequires: 5 Wood, 10 Iron');
        user.wood = num(user, 'wood') - 5;
        user.iron = num(user, 'iron') - 10;
        user.axe = 1;
        user.axedurability = 40;
        db.save();
        return done('Successfully crafted 1 Axe! 🪓');
      }
      case 'fishingrod': {
        if (num(user, 'fishingrod') > 0) return need('You already have a Fishing Rod!');
        if (num(user, 'wood') < 10 || num(user, 'iron') < 2 || num(user, 'string') < 20)
          return need('Not enough materials!\nRequires: 10 Wood, 2 Iron, 20 String');
        user.wood = num(user, 'wood') - 10;
        user.iron = num(user, 'iron') - 2;
        user.string = num(user, 'string') - 20;
        user.fishingrod = 1;
        user.fishingroddurability = 40;
        db.save();
        return done('Successfully crafted 1 Fishing Rod! 🎣');
      }
      case 'armor': {
        if (num(user, 'armor') > 0) return need('You already have Armor!');
        if (num(user, 'iron') < 30 || num(user, 'emerald') < 1 || num(user, 'diamond') < 5)
          return need('Not enough materials!\nRequires: 30 Iron, 1 Emerald, 5 Diamond');
        user.iron = num(user, 'iron') - 30;
        user.emerald = num(user, 'emerald') - 1;
        user.diamond = num(user, 'diamond') - 5;
        user.armor = 1;
        user.armordurability = 50;
        db.save();
        return done('Successfully crafted 1 Armor! 🛡️');
      }
      case 'atm': {
        if (num(user, 'atm') > 0) return need('You already have an ATM!');
        if (num(user, 'emerald') < 3 || num(user, 'diamond') < 6 || num(user, 'coins') < 10000)
          return need('Not enough materials!\nRequires: 3 Emerald, 6 Diamond, 10,000 Coins');
        user.emerald = num(user, 'emerald') - 3;
        user.diamond = num(user, 'diamond') - 6;
        user.coins = num(user, 'coins') - 10000;
        user.atm = 1;
        user.fullatm = 5000000;
        db.save();
        return done('Successfully crafted an ATM! 🏧');
      }
      default:
        return m.reply(CRAFT_LIST);
    }
  },
};
