import { actionCard } from '../../lib/interactiveKit.js';
import { withReactionStatus } from '../../lib/cosmetics.js';

export default {
  name: 'anime',
  aliases: ['waifu', 'neko', 'wallpaper'],
  category: 'anime',
  description: 'Fetch random anime pictures. Usage: .anime [waifu/neko/wallpaper]',
  cooldown: 5000,
  execute: async ({ sock, m, args, prefix, commandName }) => {
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
        
        await actionCard(sock, m.from, {
          text: `✦ *${title}* ✦`,
          image: { url: data.url },
          footer: 'NEXORA ANIME'
        }, [
          { label: `🔄 Next ${title}`, cmd: `${prefix}anime ${type}` }
        ], { quoted: m });
      } catch (err) {
        await m.reply.error(`Could not fetch image: ${err.message}`);
      }
    });
  }
};
