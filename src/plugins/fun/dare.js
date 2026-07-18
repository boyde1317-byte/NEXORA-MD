import { actionCardWithAd } from '../../lib/interactiveKit.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const DARES = [
  'Show the last photo you took.',
  'Do 20 pushups right now.',
  'Change your profile picture to a monkey for 24 hours.',
  'Voice note yourself singing the chorus of a random pop song.',
  'Send a random emoji to the 5th person in your recent chats.',
  'Let someone else pick a status for you to post.',
  'Speak in an accent for the next 5 voice notes.',
  'Type your next 5 messages with your eyes closed.',
  'Send "I know your secret" to a random contact.',
  'Draw something blindfolded and send the picture.',
  'Read the last message you sent out loud in a dramatic voice.',
  'Change your WhatsApp name to something embarrassing for 1 hour.',
  'Send a voice note of you barking like a dog.',
  'Confess something ridiculous in the group.',
  'Post a selfie right now, no filters allowed.'
];

export default {
  name: 'dare',
  aliases: ['dares'],
  category: 'fun',
  description: 'Get a random dare challenge.',
  cooldown: 2000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const prompt = DARES[Math.floor(Math.random() * DARES.length)];

    try {
      const thumbnail = await getBrandThumbnail();
      return await actionCardWithAd(sock, m.from, {
        text:   `🔥 *DARE*\n\n${prompt}`,
        footer: 'NEXORA GAMES',
      }, [
        { label: '🔥 Another Dare', cmd: `${p}dare` },
        { label: '🤔 Truth Instead', cmd: `${p}truth` },
        { label: '🎱 8-Ball', cmd: `${p}8ball Is this dare a bad idea?` },
      ], {
        title: '🔥 TRUTH OR DARE',
        body:  prompt,
        thumbnail,
      }, { quoted: m });
    } catch (err) {
      return await m.reply(`✦ *DARE* ✦\n\n🔥 ${prompt}`);
    }
  }
};
