/**
 * anime.js — random anime pictures via nekos.life.
 *
 * Rendering: NIXCODE AIRich combo (image + markdown text + tip + suggest
 * pills), the same device-proven anatomy Moonson ships for .ping/.facebookdl
 * (msping/msfb in .testrich). The previous implementation sent a nativeFlow
 * interactiveMessage with a header image + quick_reply button — the button
 * rendered but taps did nothing on stock WhatsApp clients.
 *
 * The suggest pills ARE the re-roll: tapping one sends its text as a new
 * message from the user, which the command handler dispatches — so
 * "🔄 next neko" is a plain `.anime neko` command disguised as a chip.
 */
import { AIRich } from '../../lib/NIXCODE.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'anime',
  aliases: ['waifu', 'neko', 'wallpaper'],
  category: 'anime',
  description: 'Fetch random anime pictures. Usage: .anime [waifu/neko/wallpaper]',
  cooldown: 5000,
  execute: async ({ sock, m, args, prefix, commandName }) => {
    const p = prefix || '.';
    let type = (args[0] || commandName).toLowerCase();
    if (!['waifu', 'neko', 'wallpaper'].includes(type)) {
      type = 'waifu';
    }

    await withReactionStatus(m, async () => {
      try {
        const res = await fetch(`https://nekos.life/api/v2/img/${type}`);
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();

        const title = type.toUpperCase();
        const others = ['waifu', 'neko', 'wallpaper'].filter(t => t !== type);

        await new AIRich(sock)
          .addImage(data.url)
          .addText(
            '## ◈ ' + title + '\n\n' +
            '› Category : **' + type + '**\n' +
            '› Source    : nekos.life\n' +
            '› Tap a pill below for more'
          )
          .addTip('Anime • ' + title)
          .addSuggest([
            p + 'anime ' + type,
            p + 'anime ' + others[0],
            p + 'anime ' + others[1],
          ])
          .setFooter('NEXORA • Anime')
          .send(m.from, { quoted: m });
      } catch (err) {
        await m.reply.error(`Could not fetch image: ${err.message}`);
      }
    });
  },
};
