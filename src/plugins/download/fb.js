/**
 * fb.js — Facebook video downloader (SD/HD).
 *
 * Improvements:
 *  - DownloadProgress feedback (was silent for 5-15s)
 *  - Error handling with user-friendly message
 *  - Quality label in caption
 *  - SD/HD follow-up card with both options
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { facebookDownload, isUrl } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

export default {
  name: 'fb',
  aliases: ['facebook', 'fbdl'],
  category: 'download',
  description: 'Downloads a Facebook video (SD/HD). Usage: .fb <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p   = prefix || '.';
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${p}fb <url>\`\n\nExample: \`${p}fb https://www.facebook.com/watch/?v=xxxxxx\``,
        'FACEBOOK DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Fetching Facebook video');
      try {
        const data = await facebookDownload(url);
        const best = data.hd || data.sd;
        const quality = data.hd ? 'HD' : 'SD';
        await progress.done(`✅ Got it! Sending ${quality} video...`);

        await sock.sendMessage(m.from, {
          video: { url: best },
          caption: `🎬 *Facebook Video* (${quality})`,
        }, { quoted: m });

        if (data.hd && data.sd) {
          try {
            await mixedCard(sock, m.from, {
              text: 'Prefer the standard-definition version instead?',
              footer: 'NEXORA-MD • Facebook Downloader',
            }, [
              { kind: 'url',    label: '📉 SD Version',     url: data.sd },
              { kind: 'url',    label: '📈 HD Version',     url: data.hd },
              { kind: 'action', label: '🎵 YouTube Audio',  cmd: `${p}play` },
            ], { quoted: m });
          } catch (_) {}
        }
      } catch (err) {
        await progress.fail(`❌ Facebook download failed: ${err.message}`);
      }
    });
  }
};
