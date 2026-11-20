/**
 * ceksifat.js — .ceksifat <name> — random trait reading for a name.
 *
 * Ported from luna-md/plugins/fun-ceksifat.js. Same random percentages
 * and trait pools, rebranded to NEXORA MD. One entry dropped from the
 * "Always" list per the port brief: 'Masturbating every day'.
 */

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomPercent() {
  return `${(Math.random() * 100).toFixed(1)}%`;
}

export default {
  name: 'ceksifat',
  aliases: [],
  category: 'fun',
  description: 'Get a random (totally unscientific) trait reading for a name.',
  cooldown: 2000,
  execute: async ({ m, args }) => {
    const name = args.join(' ').trim();
    if (!name) return await m.reply.error('Enter a name!\n\nExample: .ceksifat Alex');

    const text = [
      '╭━━━°「 *Traits of ' + name + '* 」°━━━',
      '┃',
      `┃• Name          : ${name}`,
      `┃• Good Manners  : ${randomPercent()}`,
      `┃• Bad Manners   : ${randomPercent()}`,
      `┃• Type of Person: ${pickRandom(['Kind-Hearted', 'Arrogant', 'Stingy', 'Generous', 'Humble', 'Insecure', 'Shy', 'Cowardly', 'Teasing', 'Crybaby'])}`,
      `┃• Always        : ${pickRandom([
        'Diligent',
        'Lazy',
        'Helping',
        'Gossiping',
        'Mischievous',
        'Random',
        'Shopping',
        'Chatting with their crush',
        'Chatting on WA because single',
        'Sad',
        'Lonely',
        'Happy',
      ])}`,
      `┃• Intelligence  : ${randomPercent()}`,
      `┃• Naughtiness   : ${randomPercent()}`,
      `┃• Bravery       : ${randomPercent()}`,
      `┃• Fear          : ${randomPercent()}`,
      '╰━━━━━━━━━━━━━━━',
    ].join('\n');

    await m.reply(text);
  },
};
