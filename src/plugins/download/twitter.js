/**
 * twitter.js — X / Twitter video downloader.
 *
 * Improvements:
 *  - DownloadProgress feedback (was silent for 5-15s)
 *  - Error handling with user-friendly message
 *  - Copy + open + cross-platform follow-up card
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { twitterDownload, isUrl } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

export default {
  name: 'twitter',
  aliases: ['x', 'twdl', 'xdl'],
  category: 'download',
  description: 'Downloads a video from an X/Twitter post. Usage: .twitter <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p   = prefix || '.';
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${p}twitter <url>\`\n\nExample: \`${p}twitter https://x.com/user/status/xxxxxx\``,
        'X / TWITTER DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Fetching X/Twitter video');
      try {
        const data = await twitterDownload(url);
        await progress.done('✅ Got it! Sending video...');

        await sock.sendMessage(m.from, {
          video:   { url: data.url },
          caption: data.title ? `🎬 *${data.title}*` : '🎬 X / Twitter Video',
        }, { quoted: m });

        try {
          await mixedCard(sock, m.from, {
            text:   '✅ *X / Twitter video downloaded!*\n\nWhat\'s next? ✦',
            footer: 'NEXORA-MD • X Downloader',
          }, [
            { kind: 'copy',   label: '📋 Copy Post URL',   value: url },
            { kind: 'url',    label: '🔗 Open on X',        url:   url },
            { kind: 'action', label: '📸 Try Instagram',    cmd:   `${p}ig` },
            { kind: 'action', label: '🎵 TikTok Download',  cmd:   `${p}tiktok` },
          ], { quoted: m });
        } catch (_) {}
      } catch (err) {
        await progress.fail(`Twitter download failed: ${err.message}`);
      }
    });
  }
};
