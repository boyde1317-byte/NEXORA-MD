/**
 * pickup.js — random pickup line, optionally delivered "to" a mention.
 *
 * Original line list written for NEXORA — nothing copied from another
 * bot or listicle site. Playful, PG, and safe to send in any group.
 */
import { actionCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

const LINES = [
  'Are you a charger? Because I feel 100% around you.',
  'Do you have a map? Because I keep getting lost in your status updates.',
  'Are you Wi-Fi? Because the connection is undeniable.',
  'You must be a meme, because I can\'t stop sharing you with my friends.',
  'Are you a battery? Because you\'ve been draining my thoughts all day.',
  'Is your name Google? Because you\'ve got everything I\'ve been searching for.',
  'Are you a screenshot? Because I want to keep you forever.',
  'Do you play Valorant? Because you\'ve taken my heart hostage.',
  'Are you made of copper and tellurium? Because you\'re Cu-Te.',
  'If you were a pizza topping, you\'d be extra — because you\'re above and beyond.',
  'Are you a playlist? Because you\'ve got every song my heart knows.',
  'You must be Jollof rice, because everyone at the party is here for you.',
  'Are you a keyboard? Because you\'re just my type.',
  'Do you believe in love at first sight, or should I send this message again?',
  'Are you a bank? Because my interest in you keeps compounding.',
  'You must be trending, because my whole feed is about you.',
  'Are you daylight savings? Because you just gave me an extra hour of happiness.',
  'Is your dad a photographer? Because you\'re a whole picture-perfect moment.',
  'Are you a warranty? Because I want you around for the long run.',
  'You must be the last slice, because nobody deserves you more than me.',
];

export default {
  name: 'pickup',
  aliases: ['pickupline', 'flirt'],
  category: 'fun',
  description: 'Drops a random pickup line. Tag someone to deliver it to them. 100% cheesy, 0% harmful.',
  cooldown: 4000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const mentions = m.msg?.contextInfo?.mentionedJid ?? [];
    const target = mentions[0] || m.quoted?.sender || null;

    await withReactionStatus(m, async () => {
      const line = LINES[Math.floor(Math.random() * LINES.length)];
      const deliver = target && target !== m.sender;

      const text = deliver
        ? `💌 *A delivery for you:*\n\n💬 _"${line}"_\n\n_From a secret admirer (it's ${'@' + m.sender.split('@')[0].split(':')[0]}, he wasn't brave enough to say it)_`
        : `💌 *Pickup line of the day:*\n\n💬 _"${line}"_\n\n_Use responsibly. Results not guaranteed._`;

      await actionCard(sock, m.from, { text, footer: 'NEXORA • Pickup Lines 💘' },
        [{ kind: 'action', label: '💘 Another One', cmd: `${p}pickup` }],
        { quoted: m, mentions: deliver ? [target, m.sender] : [] });

      await m.react('💘');
    });
  }
};
