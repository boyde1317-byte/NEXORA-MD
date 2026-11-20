/**
 * cekkhodam.js — .cekkhodam <name> — reveal your (joke) guardian spirit.
 *
 * Ported from LUNA MD plugins/fun-cekkhodam.js.
 *
 * Differences from the LUNA original:
 *   - NexoraFlex plugin contract; `m.chat` -> `m.from`.
 *   - The per-name cache lived on `conn.khodam` in the original; here
 *     it is a module-level Map (same process-lifetime behaviour, no
 *     mutation of the socket object). A name always gets the same
 *     khodam once drawn.
 *   - `pickRandom` is a local helper (the LUNA global does not exist
 *     here). The khodam list is kept verbatim (already English).
 *   - Aliases cover the original regex:
 *     /^(cek(khodam|kodam)|kodam|khodam)$/i.
 */
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const cache = new Map();

const khodamList = [
	{ nama: 'Swamp Cat', deskripsi: 'Wanders the swamp, meows along with the genderuwo' },
	{ nama: 'Ocean Monitor Lizard', deskripsi: 'Has gills, but is allergic to water' },
	{ nama: 'Electric Fan', deskripsi: 'Loves spinning but stays in place' },
	{ nama: 'Farhan Kebab', deskripsi: 'If you call him, he instantly makes you hungry' },
	{ nama: 'Rossi the Pedicab', deskripsi: 'MotoGP champion but rides a pedicab' },
	{ nama: 'Indomaret Employee', deskripsi: 'His smile never runs out, like a discount promo' },
	{ nama: 'Treasure Chest', deskripsi: 'Could hold gold, could hold debt' },
	{ nama: 'Funny Kuntilanak', deskripsi: 'Loves joking, makes the tuyul laugh' },
	{ nama: '3-Headed Pocong', deskripsi: 'Lots of heads, but still empty inside' },
	{ nama: 'Pace Yunus', deskripsi: 'Legendary Pace, can play football while flying' },
	{ nama: 'Charger Head', deskripsi: 'Can charge batteries, but loves overheating' },
	{ nama: 'Green Banana', deskripsi: 'Sweet but deceiving, like an ex' },
	{ nama: 'Red Zebra', deskripsi: 'Rare, only appears when you owe money' },
	{ nama: 'Wet Towel', deskripsi: 'Sticks to you, especially after a shower' },
	{ nama: 'Tuyul', deskripsi: 'Dark economy expert. Master of the empty wallet' },
	{ nama: 'Titid Kuda', deskripsi: "The most 'overpowered' mystical power" },
	{ nama: 'Goat Torpedo', deskripsi: 'Can explode if you flick it' },
	{ nama: 'Black Ant', deskripsi: 'Small but loves causing chaos in the kitchen' },
	{ nama: 'Red Dragon', deskripsi: 'Loves appearing when the power goes out' },
	{ nama: 'Barbie', deskripsi: "Beautiful but can't cook" },
	{ nama: 'Handsome Gondoruwo', deskripsi: 'Gondoruwo boyband version' },
	{ nama: 'Witchcraft Kid', deskripsi: "Small but pulls the neighbour's grey hairs" },
	{ nama: 'Lost Underwear', deskripsi: 'The biggest mystery in the boarding house' },
	{ nama: 'Spilled Milk', deskripsi: 'Loves making floors slippery and hearts uneasy' },
	{ nama: 'Flying Snakehead Fish', deskripsi: 'Flies when sleepy' },
	{ nama: 'Smelly Pillow', deskripsi: 'Sleep protector and enemy paralyser' },
	{ nama: 'Magic Spatula', deskripsi: 'If you throw it, it comes back by itself' },
	{ nama: 'Fake Flying Broom', deskripsi: 'Can only hover 3 cm' },
	{ nama: 'Lion With Glasses', deskripsi: 'His eyes are bad, but still fierce' },
	{ nama: 'Genderuwo Fashion Week', deskripsi: 'Scary but stylish' },
	{ nama: 'Nenek Lampir Reborn', deskripsi: 'Young version, loves TikTok' },
	{ nama: 'Magic Eraser', deskripsi: "Can erase your ex's memories" },
	{ nama: 'Flying Wok', deskripsi: 'The ultimate mum weapon' },
	{ nama: 'Cute Frog', deskripsi: 'His croak makes people fall in love' },
	{ nama: 'Mystical Bakwan', deskripsi: 'If you burn it, a spell comes out' },
	{ nama: 'Refill Aqua', deskripsi: 'Pure, but beware of bacteria' },
	{ nama: 'Haunted Fridge', deskripsi: 'Little inside, lots of noise' },
	{ nama: 'Ghost Flip-Flops', deskripsi: 'The pain reaches your heart' },
	{ nama: 'Moody Crab', deskripsi: 'Sometimes pinches, sometimes cries' },
	{ nama: 'Dry Toothpaste', deskripsi: 'Useless but still in the bathroom' },
	{ nama: 'Devil Rambutan', deskripsi: 'Smooth thorns, horror inside' },
	{ nama: 'Flying Satay', deskripsi: "Can vanish if you don't guard it" },
	{ nama: 'Bitter Coffee', deskripsi: 'Brewer of heartbreak and awareness' },
	{ nama: 'Guardian Bajigur', deskripsi: 'Warm, but gives you goosebumps' },
	{ nama: 'Bloody Cendol', deskripsi: 'Bought in another realm' },
	{ nama: 'Snake Head Meatballs', deskripsi: 'Chewy, but sharp' },
	{ nama: 'Magic Screwdriver', deskripsi: "Can open people's fate" },
	{ nama: 'Broken TV', deskripsi: 'Ants on screen, tuyul inside' },
	{ nama: 'Used Tissue', deskripsi: "An ex's khodam that's hard to forget" },
	{ nama: 'Leaky Tent', deskripsi: 'Brings you close to water and suffering' },
	{ nama: 'Crying Piggy Bank', deskripsi: "If you open it, it's full of debt" },
	{ nama: '5-Legged Chicken', deskripsi: 'Runs fast, confused about shoes' },
	{ nama: 'Living Potato', deskripsi: 'Fry it a little and it runs away' },
	{ nama: 'Mystical Chopsticks', deskripsi: 'Good for pulling out negative energy' },
	{ nama: 'Cracked Glass', deskripsi: 'Breaks easily, like our relationship' },
	{ nama: 'Anti-Soulmate Hat', deskripsi: 'Wear it = single for life' },
	{ nama: 'Possessed Flashlight', deskripsi: 'Sometimes lights up, sometimes prays by itself' },
	{ nama: 'Cursed Tie', deskripsi: 'Whoever wears it becomes lovesick' },
	{ nama: 'Mystical Fried Noodles', deskripsi: 'Smells delicious, makes you forget the world' },
	{ nama: 'Alien Serabi', deskripsi: 'A taste unknown to mankind' },
	{ nama: 'Laggy Phone', deskripsi: 'God-level patient khodam' },
	{ nama: 'Lost TV Remote', deskripsi: 'Can appear in the fridge' },
	{ nama: 'Dim Lamp', deskripsi: 'Makes a horror aura even at noon' },
	{ nama: 'Magic Rat', deskripsi: 'Can steal instant noodles' },
	{ nama: 'Foggy Clothesline', deskripsi: 'Disappears when it rains' },
	{ nama: 'Heaven-Smelling Jacket', deskripsi: 'Smells weird but feels warm in the heart' },
	{ nama: 'Mystery Doll', deskripsi: 'Her smile tortures your soul' },
	{ nama: 'Kuntilanak Horn', deskripsi: 'One honk and the neighbours faint' },
	{ nama: 'Failed Mosquito Repellent', deskripsi: 'The more you use it, the more mosquitoes come' },
	{ nama: 'Emotional Lighter', deskripsi: "Only lights when you don't need it" },
	{ nama: 'Magic Mirror', deskripsi: 'If you look, your face becomes your ex' },
	{ nama: 'Magic Powder', deskripsi: 'Wear it and you vanish, your face vanishes too' },
];

export default {
  name: 'cekkhodam',
  aliases: ['cekkodam', 'kodam', 'khodam'],
  category: 'fun',
  description: 'Reveal your joke guardian spirit. Usage: .cekkhodam <name>',
  cooldown: 3000,
  execute: async ({ m, args, prefix, commandName }) => {
    const cmd = commandName || 'cekkhodam';
    const text = (args || []).join(' ').trim();
    if (!text) {
      return m.reply(`Enter your name!\n\nExample:\n${prefix}${cmd} Abay gay`);
    }
    let data = cache.get(text);
    if (!data) {
      data = pickRandom(khodamList);
      cache.set(text, data);
    }
    return m.reply(
      `👤 Name: *${text}*\n🔮 Your khodam is: *${data.nama}*\n\n📖 Description:\n${data.deskripsi}`
    );
  },
};
