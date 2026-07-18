/**
 * twitter.js — X / Twitter video downloader.
 *
 * Upgraded: adds mixedCard after download with share/audio follow-up buttons.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { twitterDownload, isUrl } from '../../lib/downloader.js';

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
      const data = await twitterDownload(url);
      await sock.sendMessage(m.from, {
        video:   { url: data.url },
        caption: data.title ? `🎬 *${data.title}*` : '🎬 X / Twitter Video',
      }, { quoted: m });

      // Follow-up interactive card
      try {
        await mixedCard(sock, m.from, {
          text:   '✅ *X / Twitter video downloaded!*\n\nWant to do more?',
          footer: 'NEXORA-MD • X Downloader',
        }, [
          { kind: 'copy',   label: '📋 Copy Post URL',   value: url },
          { kind: 'url',    label: '🔗 Open on X',        url:   url },
          { kind: 'action', label: '📸 Try Instagram',    cmd:   `${p}ig` },
          { kind: 'action', label: '🎵 TikTok Download',  cmd:   `${p}tiktok` },
        ], { quoted: m });
      } catch (_) { /* follow-up card is non-critical */ }
    });
  }
};
