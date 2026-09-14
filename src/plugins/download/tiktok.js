/**
 * tiktok.js — TikTok video downloader (no watermark).
 *
 * Improvements:
 *  - DownloadProgress feedback (was silent for 5-15s)
 *  - Error handling with user-friendly message
 *  - Author + duration metadata in caption
 *  - Follow-up card with audio download + other platform buttons
 */
import { withReactionStatus} from '../../lib/cosmetics.js';

import { tiktokDownload, isUrl} from '../../lib/downloader.js';
import { DownloadProgress} from '../../lib/progress.js';

export default {
  name: 'tiktok',
  aliases: ['tt', 'ttdl'],
  category: 'download',
  description: 'Downloads a TikTok video without the watermark. Usage: .tiktok <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p   = prefix || '.';
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${p}tiktok <url>\`\n\nExample: \`${p}tiktok https://vt.tiktok.com/xxxxxx\``,
        'TIKTOK DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Fetching TikTok video');
      try {
        const data = await tiktokDownload(url);
        await progress.done('✅ Got it! Sending video...');

        const meta = [
          data.title    ? `🎬 *${data.title}*`           : '🎬 TikTok Video',
          data.author   ? `👤 ${data.author}`             : null,
        ].filter(Boolean).join('\n');

        // ── Rich tier: native reel player + stats card (TikTok-style) ──
        const reelSent = await sendReelWithStatsCard(sock, m.from, m, {
          reel: {
            title: data.title || 'TikTok Video',
            profileIconUrl: data.thumbnail,
            thumbnailUrl: data.thumbnail,
            videoUrl: data.video,
          },
          tableHeaders: ['Metric', 'Value'],
          tableRows: [
            ['Author', (data.author || 'Unknown').slice(0, 40)],
            ['Quality', 'No watermark'],
            ['Source', 'TikTok'],
          ],
          headerText: `🎬 ${data.title || 'TikTok Video'}`.slice(0, 60),
          footer: '© NEXORA-MD by Aizen',
        });
        if (reelSent) return;

        await sock.sendMessage(m.from, {
          video: { url: data.video },
          caption: `${meta}\n_No watermark_`,
        }, { quoted: m });

        if (data.audio) {
        }
      } catch (err) {
        await m.reply.error(`TikTok download failed: ${err.message}`);
        throw err;
      }
    });
  }
};
