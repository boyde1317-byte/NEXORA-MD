/**
 * dare2.js — .dare2 — random dare challenge.
 *
 * Ported from luna-md/plugins/fun-dare.js. The LUNA original fetched the
 * BochilTeam dare list and called `result.data.getRandom()` — a global
 * Array helper that does not exist in NexoraFlex, so the pick is done
 * locally. A small built-in fallback list is used if the fetch fails.
 * Named dare2 because NexoraFlex already ships .dare (fun/dare.js).
 */

const DARE_URL = 'https://raw.githubusercontent.com/BochilTeam/database/master/kata-kata/dare.json';

const FALLBACK_DARES = [
  'Do 20 pushups right now.',
  'Send a voice note singing the chorus of any song.',
  'Change your profile picture to something silly for 1 hour.',
  'Text "I know your secret" to a random contact.',
  'Speak in an accent for your next 5 voice notes.',
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default {
  name: 'dare2',
  aliases: [],
  category: 'fun',
  description: 'Get a random dare challenge (BochilTeam dare list).',
  cooldown: 2000,
  execute: async ({ m }) => {
    let dare = null;
    try {
      const res = await fetch(DARE_URL, { signal: AbortSignal.timeout(10000) });
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      if (list.length) dare = pickRandom(list);
    } catch (err) {
      console.warn('[dare2] dare list fetch failed, using fallback:', err.message);
    }
    if (!dare) dare = pickRandom(FALLBACK_DARES);
    await m.reply(`🔥 *DARE*\n\n${dare}`);
  },
};
