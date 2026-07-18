import { actionCardWithAd } from '../../lib/interactiveKit.js';
import { getBrandThumbnail } from '../../lib/cosmetics.js';
import { asciiBuilder } from '../../ui/asciiBuilder.js';

const TRUTHS = [
  'What is your biggest fear?',
  'Have you ever lied to get out of trouble? What was the lie?',
  'What is the most embarrassing thing in your search history?',
  'Who was your first crush?',
  'What is a secret you have never told anyone?',
  'What is the most childish thing you still do?',
  'Have you ever ghosted someone? Why?',
  'What is the worst habit you have?',
  'If you had to delete one app from your phone forever, what would it be?',
  'What is the biggest mistake you have ever made?',
  'Who do you text the most?',
  'What is the most awkward text you have accidentally sent?',
  'Have you ever practiced kissing in a mirror?',
  'What is a rumor you spread or heard that turned out to be false?',
  'If you could swap lives with someone in this group for a day, who would it be?'
];

export default {
  name: 'truth',
  aliases: ['truths'],
  category: 'fun',
  description: 'Get a random truth question.',
  cooldown: 2000,
  execute: async ({ m, sock, prefix }) => {
    const p = prefix || '.';
    const prompt = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];

    try {
      const thumbnail = await getBrandThumbnail();
      return await actionCardWithAd(sock, m.from, {
        text:   `🤔 *TRUTH*\n\n${prompt}`,
        footer: 'NEXORA GAMES',
      }, [
        { label: '🤔 Another Truth', cmd: `${p}truth` },
        { label: '🔥 Dare Instead',  cmd: `${p}dare` },
        { label: '🎱 8-Ball',        cmd: `${p}8ball Will they tell the truth?` },
      ], {
        title: '🤔 TRUTH OR DARE',
        body:  prompt,
        thumbnail,
      }, { quoted: m });
    } catch (err) {
      return await m.reply(`✦ *TRUTH* ✦\n\n🤔 ${prompt}`);
    }
  }
};
