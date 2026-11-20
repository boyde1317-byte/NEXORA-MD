/**
 * truth2.js — .truth2 — random truth question.
 *
 * Ported from luna-md/plugins/fun-truth.js. Same note as dare2: the
 * LUNA original relied on a global `getRandom()` Array helper that does
 * not exist in NexoraFlex, so the pick is done locally, with a small
 * built-in fallback list if the BochilTeam fetch fails. Named truth2
 * because NexoraFlex already ships .truth (fun/truth.js).
 */

const TRUTH_URL = 'https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/truth.json';

const FALLBACK_TRUTHS = [
  'What is your biggest fear?',
  'What is the most embarrassing thing in your search history?',
  'Who was your first crush?',
  'What is the biggest lie you have ever told?',
  'What is something you have never told anyone?',
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default {
  name: 'truth2',
  aliases: [],
  category: 'fun',
  description: 'Get a random truth question (BochilTeam truth list).',
  cooldown: 2000,
  execute: async ({ m }) => {
    let truth = null;
    try {
      const res = await fetch(TRUTH_URL, { signal: AbortSignal.timeout(10000) });
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      if (list.length) truth = pickRandom(list);
    } catch (err) {
      console.warn('[truth2] truth list fetch failed, using fallback:', err.message);
    }
    if (!truth) truth = pickRandom(FALLBACK_TRUTHS);
    await m.reply(`🤔 *TRUTH*\n\n${truth}`);
  },
};
