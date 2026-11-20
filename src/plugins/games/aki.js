/**
 * aki.js — .aki — Akinator guessing game.
 *
 * Ported from luna-md/plugins/game-akinator.js, rebuilt on the SAME
 * keyless backend as the luna-md/plugins/akinator.js port
 * (mr-obito-api.vercel.app: /akinator_start, /akinator_answer,
 * /akinator_back) instead of the original's @aqul/akinator-api package,
 * which is not a NexoraFlex dependency.
 *
 * ADAPTATIONS (all deliberate):
 *   - No conn.sendButton (does not exist in NX) and no `before` hook
 *     (not supported by the NX dispatcher). The game is played through
 *     the command itself: `.aki start`, then answer with
 *     `.aki yes` / `.aki no` / `.aki don't know` / `.aki maybe` /
 *     `.aki probably not`, plus `.aki back` and `.aki delete`.
 *   - No HTML scene: questions and results are plain text, so nothing
 *     depends on the GenAI HTML relay.
 *   - Sessions live in a module-level Map keyed by `${chat}-${sender}`,
 *     so two people can play in the same group at once (the LUNA
 *     original keyed one session per chat).
 *   - One session per player: `.aki start` while a game is running
 *     refuses and points at the current question instead of overwriting.
 */

const API = 'https://mr-obito-api.vercel.app/api';

const sessions = new Map();

const ANSWER_MAP = {
  yes: 0,
  no: 1,
  "don't know": 2,
  maybe: 3,
  'probably not': 4,
};

const ANSWER_WORDS = Object.keys(ANSWER_MAP);

function questionText(s, question) {
  return [
    '🎩 *AKINATOR*',
    'Think of a character — a person, an anime character, anyone — and I will guess who it is.',
    '',
    `❓ ${question}`,
    '',
    `📊 Progress: ${Math.floor(s.progression || 0)}%  •  Question ${(s.step ?? 0) + 1}`,
    '',
    'Answer with:',
    '`.aki yes`  •  `.aki no`  •  `.aki don\'t know`',
    '`.aki maybe`  •  `.aki probably not`',
    '`.aki back` to go back  •  `.aki delete` to give up',
  ].join('\n');
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Akinator API error: ${res.status}`);
  return res.json();
}

export default {
  name: 'aki',
  aliases: [],
  category: 'games',
  description: 'Play Akinator — think of a character and I will guess it. Start with .aki start, then answer .aki yes / no / don\'t know / maybe / probably not.',
  cooldown: 2000,
  execute: async ({ m, sock, args }) => {
    const key = `${m.from}-${m.sender}`;
    const input = args.join(' ').toLowerCase().trim();

    // No argument: show the current question, or the intro.
    if (!input) {
      const s = sessions.get(key);
      if (s?.question) return await m.reply(questionText(s, s.question));
      return await m.reply([
        '🎩 *AKINATOR*',
        'Think of a character and I will guess who it is!',
        '',
        'Start with `.aki start`, then answer each question with',
        '`.aki yes` / `.aki no` / `.aki don\'t know` / `.aki maybe` / `.aki probably not`.',
      ].join('\n'));
    }

    try {
      if (input === 'start') {
        if (sessions.has(key)) {
          const s = sessions.get(key);
          return await m.reply(`🎩 A game is already running for you.\n\n${questionText(s, s.question || '...')}`);
        }
        const data = await apiPost('/akinator_start');
        const s = {
          session: data.session,
          signature: data.signature,
          step: data.step,
          progression: data.progression,
          question: data.question,
        };
        sessions.set(key, s);
        return await m.reply(questionText(s, data.question));
      }

      const s = sessions.get(key);
      if (!s) {
        return await m.reply('⚠️ No Akinator game running for you. Start one with `.aki start`.');
      }

      if (input === 'delete') {
        sessions.delete(key);
        return await m.reply('🚪 Akinator game stopped. Type `.aki start` to play again.');
      }

      if (input === 'back') {
        const data = await apiPost('/akinator_back', {
          session: s.session,
          signature: s.signature,
          step: s.step,
          progression: s.progression,
          cm: 'false',
        });
        s.step = data.step;
        s.progression = data.progression;
        s.question = data.question;
        return await m.reply(questionText(s, data.question));
      }

      if (!(input in ANSWER_MAP)) {
        return await m.reply(`❓ That is not an answer. Reply with one of:\n${ANSWER_WORDS.map((w) => `• .aki ${w}`).join('\n')}\n\nOr \`.aki back\` / \`.aki delete\`.`);
      }

      const data = await apiPost('/akinator_answer', {
        session: s.session,
        signature: s.signature,
        step: s.step,
        progression: s.progression,
        answer: ANSWER_MAP[input],
        cm: 'false',
        sid: 'NaN',
        question_filter: 'string',
      });

      if (data.name_proposition) {
        sessions.delete(key);
        const caption = [
          '🎉 *AKINATOR GUESSED IT!*',
          '',
          `👤 *${data.name_proposition}*`,
          data.description_proposition ? `${data.description_proposition}` : '',
          '',
          'Play again with `.aki start`.',
        ].filter(Boolean).join('\n');
        if (data.photo) {
          try {
            return await sock.sendMessage(m.from, { image: { url: data.photo }, caption }, { quoted: m });
          } catch (_) { /* fall through to text */ }
        }
        return await m.reply(caption);
      }

      s.step = data.step;
      s.progression = data.progression;
      s.question = data.question;
      return await m.reply(questionText(s, data.question));
    } catch (err) {
      console.error('[aki] error:', err.message);
      sessions.delete(key);
      return await m.reply(`❌ Akinator hit an error (${err.message}). Game stopped — type \`.aki start\` to try again.`);
    }
  },
};
