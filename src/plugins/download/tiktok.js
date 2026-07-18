import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { tiktokDownload, isUrl } from '../../lib/downloader.js';

export default {
  name: 'tiktok',
  aliases: ['tt', 'ttdl'],
  category: 'download',
  description: 'Downloads a TikTok video without the watermark. Usage: .tiktok <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${prefix}tiktok <url>\`\n\nExample: \`${prefix}tiktok https://vt.tiktok.com/xxxxxx\``,
        'TIKTOK DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const data = await tiktokDownload(url);
      await sock.sendMessage(m.from, {
        video: { url: data.video },
        caption: `🎬 *${data.title || 'TikTok Video'}*\n_No watermark_`,
      }, { quoted: m });

      if (data.audio) {
        await mixedCard(sock, m.from, {
          text: 'Want just the audio track from this video?',
          footer: 'NEXORA-MD • TikTok Downloader',
        }, [
          { kind: 'url', label: '🎵 Download Audio', url: data.audio },
        ], { quoted: m });
      }
    });
  }
};
