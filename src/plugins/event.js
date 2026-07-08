export default {
  name: 'event',
  aliases: ['createevent', 'meet'],
  category: 'general',
  description: 'Generates a WhatsApp event card in the chat (Special fork capability).',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    const input = args.join(' ');
    if (!input || !input.includes('|')) {
      return await m.reply('❌ Formatting error. Usage:\n`!event Title | Description | MinutesFromNow | MeetingLink`');
    }

    const parts = input.split('|').map(p => p.trim());
    const name = parts[0];
    const description = parts[1] || 'No description provided';
    const minutesAhead = parseInt(parts[2] || '30', 10);
    const joinLink = parts[3] || 'https://call.whatsapp.com/video/ai-studio';

    // Calculate start time in unix timestamp (seconds)
    const startTimeUnix = Math.floor(Date.now() / 1000) + (minutesAhead * 60);

    try {
      await sock.sendMessage(m.from, {
        eventMessage: {
          name,
          description,
          startTime: String(startTimeUnix),
          joinLink,
          extraGuestsAllowed: true,
          isCanceled: false
        }
      }, { quoted: m });
    } catch (err) {
      await m.reply(`❌ Failed to send event message: ${err.message}`);
    }
  }
};
