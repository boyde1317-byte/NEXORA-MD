import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { facebookDownload, isUrl } from '../../lib/downloader.js';

export default {
  name: 'fb',
  aliases: ['facebook', 'fbdl'],
  category: 'download',
  description: 'Downloads a Facebook video (SD/HD). Usage: .fb <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${prefix}fb <url>\`\n\nExample: \`${prefix}fb https://www.facebook.com/watch/?v=xxxxxx\``,
        'FACEBOOK DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const data = await facebookDownload(url);
      const best = data.hd || data.sd;
      await sock.sendMessage(m.from, {
        video: { url: best },
        caption: `🎬 *Facebook Video*${data.hd ? ' (HD)' : ''}`,
      }, { quoted: m });

      if (data.hd && data.sd) {
        await mixedCard(sock, m.from, {
          text: 'Prefer the standard-definition version instead?',
          footer: 'NEXORA-MD • Facebook Downloader',
        }, [
          { kind: 'url', label: '📉 SD Version', url: data.sd },
        ], { quoted: m });
      }
    });
  }
};
