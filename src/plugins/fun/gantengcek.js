/**
 * gantengcek.js — .gantengcek / .cekganteng / .handsomecheck — random
 * handsome-level joke.
 *
 * Ported from luna-md/plugins/fun-gantengcek.js. The joke list is kept
 * verbatim (already English); only the transport changed (conn.reply on
 * m.chat -> m.reply).
 */

const LEVELS = [
  'Handsome Level : 1%\n\nAmbatukam... be patient bro, do not look in the mirror at noon.',
  'Handsome Level : 3%\n\nEven the mirror cries looking at your face 😭',
  'Handsome Level : 5%\n\nYour face is like public WiFi, anyone can get it but nobody wants to connect.',
  'Handsome Level : 10%\n\nThey say handsome, but when you look it lags.',
  'Handsome Level : 15%\n\nIf you were a game character, you would be in the "ugliest boss" category.',
  'Handsome Level : 22%\n\nYour face has a built-in blur effect.',
  'Handsome Level : 30%\n\nNot bad... for scaring thieves.',
  'Handsome Level : 38%\n\nCool from far away, shocking up close.',
  'Handsome Level : 45%\n\nBarely handsome, like signal in the mountains.',
  'Handsome Level : 52%\n\nHalf handsome, half ambatukam.',
  'Handsome Level : 60%\n\nWorks if it is a bit dark and you use a filter.',
  'Handsome Level : 70%\n\nGirls like you… but only as a friend 😔',
  'Handsome Level : 77%\n\nWith a full-face helmet, 10/10',
  'Handsome Level : 83%\n\nBig-brother energy, IMO 100+ stars, makes the little ones fall for you on the spot.',
  'Handsome Level : 89%\n\nMakes girls forget their IG password.',
  'Handsome Level : 94%\n\nAutomatically on girls TikTok FYP.',
  'Handsome Level : 97%\n\nWhen you show up, the mirror greets you first.',
  'Handsome Level : 100%\n\nYOU REALLY ARE THE MOST HANDSOME GUY IN THE WHOLE UNIVERSE!! 😎🔥',
];

export default {
  name: 'gantengcek',
  aliases: ['cekganteng', 'handsomecheck'],
  category: 'fun',
  description: 'Check your (random) handsome level. Results may hurt.',
  cooldown: 2000,
  execute: async ({ m }) => {
    const result = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    await m.reply(`😎 *HANDSOME CHECK*\n\n${result}`);
  },
};
