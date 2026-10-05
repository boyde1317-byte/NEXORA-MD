/**
 * tarot.js — card-of-the-day tarot draw.
 *
 * The draw is DETERMINISTIC per user per calendar day: the same person
 * gets the same card no matter how many times they ask that day (a real
 * tarot reader would judge you for asking twice anyway). A fresh UTC
 * day deals a fresh card. All meanings are original one-liners.
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

const DECK = [
  { card: 'The Fool', icon: '🃏', meaning: 'New beginnings. Jump — the net is probably fine.', advice: 'Say yes to the invite.' },
  { card: 'The Magician', icon: '🪄', meaning: 'Everything you need is already in your hands.', advice: 'Start the project today.' },
  { card: 'The High Priestess', icon: '🌙', meaning: 'You already know the answer. You\'re just stalling.', advice: 'Trust the gut feeling.' },
  { card: 'The Empress', icon: '🌷', meaning: 'Growth, comfort and abundance are coming.', advice: 'Water what you planted.' },
  { card: 'The Emperor', icon: '🏛️', meaning: 'Structure wins today. Discipline over vibes.', advice: 'Make the plan. Follow the plan.' },
  { card: 'The Lovers', icon: '💞', meaning: 'A choice of the heart is on the table.', advice: 'Choose honestly, not politely.' },
  { card: 'The Chariot', icon: '🏎️', meaning: 'Momentum is yours — grab the wheel.', advice: 'Push through the messy middle.' },
  { card: 'Strength', icon: '🦁', meaning: 'Soft power beats loud force today.', advice: 'Respond, don\'t react.' },
  { card: 'The Hermit', icon: '🕯️', meaning: 'Step back. The noise is hiding the signal.', advice: 'One quiet hour, no phone.' },
  { card: 'Wheel of Fortune', icon: '🎡', meaning: 'The tide is turning in your favor.', advice: 'Ride it — don\'t overthink it.' },
  { card: 'Justice', icon: '⚖️', meaning: 'Things balance out today. Receipts included.', advice: 'Tell the truth early.' },
  { card: 'The Hanged Man', icon: '🙃', meaning: 'Pause is not failure. Look from a new angle.', advice: 'Flip the problem upside down.' },
  { card: 'Death', icon: '🦋', meaning: 'An ending clears space. Let it go.', advice: 'Delete the dead weight.' },
  { card: 'Temperance', icon: '🫖', meaning: 'Balance is boring, and boring is winning.', advice: 'Half the portions, double the patience.' },
  { card: 'The Devil', icon: '😈', meaning: 'That habit is watching you back.', advice: 'Skip one round of it today.' },
  { card: 'The Tower', icon: '🗼', meaning: 'Chaos is just change with a bad haircut.', advice: 'Don\'t rebuild the old thing.' },
  { card: 'The Star', icon: '⭐', meaning: 'Hope is not naive. Keep going.', advice: 'Show your work to someone.' },
  { card: 'The Moon', icon: '🌜', meaning: 'Not everything is what it looks like tonight.', advice: 'Sleep on the decision.' },
  { card: 'The Sun', icon: '☀️', meaning: 'Pure green lights today. Enjoy it.', advice: 'Do the fun thing first.' },
  { card: 'Judgement', icon: '📣', meaning: 'A wake-up call you\'ve been snoozing.', advice: 'Answer the message you\'ve avoided.' },
  { card: 'The World', icon: '🌍', meaning: 'A chapter closes properly. Full circle.', advice: 'Celebrate before starting the next.' },
];

function stableHash(str) {
  let h = 0;
  for (const ch of str) h = (Math.imul(31, h) + ch.charCodeAt(0)) >>> 0;
  return h;
}

export default {
  name: 'tarot',
  aliases: ['cardoftheday', 'draw'],
  category: 'fun',
  description: 'Pulls your tarot card of the day. Same card all day (a reader would judge you for asking twice).',
  cooldown: 5000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';

    await withReactionStatus(m, async () => {
      const dayKey = new Date().toISOString().slice(0, 10);
      const seed = stableHash(`${m.sender}|${dayKey}`);
      const draw = DECK[seed % DECK.length];
      const reversed = (seed >>> 7) % 5 === 0; // ~20% reversed draws
      const mood = ['✨ glowing', '🌫️ murky', '🔥 intense', '🌱 quiet growth', '🎯 sharp'][seed % 5];

      const cardName = reversed ? `${draw.card} (reversed)` : draw.card;
      const meaning = reversed
        ? `The energy is blocked or turned inward: ${draw.meaning.toLowerCase()} — but stalled, for now.`
        : draw.meaning;

      const text =
        `🔮 *TAROT DRAW OF THE DAY*\n\n` +
        `${draw.icon} *${cardName}*\n\n` +
        `📜 ${meaning}\n\n` +
        `🎯 *Today's advice:* ${reversed ? 'Unstick it first: ' : ''}${draw.advice}\n\n` +
        `📡 Daily mood: ${mood}\n\n` +
        `_Same card until midnight — the deck is watching you._`;

      await actionCard(sock, m.from, { text, footer: 'NEXORA • Tarot 🔮' },
        [{ kind: 'action', label: '🔮 Check Tomorrow', cmd: `${p}tarot` }],
        { quoted: m });

      await m.react('🔮');
    });
  }
};
