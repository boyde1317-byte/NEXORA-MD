/**
 * ig.js — Instagram post / reel / story downloader.
 *
 * Upgraded: adds externalAdReply banner on the first media item and a
 * mixedCard after all items are sent with follow-up download actions.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { instagramDownload, isUrl } from '../../lib/downloader.js';

export default {
  name: 'ig',
  aliases: ['instagram', 'igdl'],
  category: 'download',
  description: 'Downloads Instagram posts, reels, and stories. Usage: .ig <url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p   = prefix || '.';
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${p}ig <url>\`\n\nExample: \`${p}ig https://www.instagram.com/p/xxxxxx/\``,
        'INSTAGRAM DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const items = await instagramDownload(url);
      const batch = items.slice(0, 10);

      for (let i = 0; i < batch.length; i++) {
        const item    = batch[i];
        const isVideo = /\.mp4(\?|$)/i.test(item.url) ||
                        (item.resolution || '').toLowerCase().includes('video');

        const caption = i === 0
          ? `📥 *Instagram Download* (${batch.length} item${batch.length !== 1 ? 's' : ''})`
          : `📥 Item ${i + 1} of ${batch.length}`;

        if (isVideo) {
          await sock.sendMessage(m.from, {
            video:   { url: item.url },
            caption,
          }, { quoted: i === 0 ? m : undefined });
        } else {
          await sock.sendMessage(m.from, {
            image:   { url: item.url },
            caption,
          }, { quoted: i === 0 ? m : undefined });
        }
      }

      // Follow-up interactive card after all items
      try {
        await mixedCard(sock, m.from, {
          text:   `✅ *Downloaded ${batch.length} item${batch.length !== 1 ? 's' : ''} from Instagram!*`,
          footer: 'NEXORA-MD • Instagram Downloader',
        }, [
          { kind: 'copy',   label: '📋 Copy Post URL',   value: url },
          { kind: 'url',    label: '🔗 Open on Instagram', url:   url },
          { kind: 'action', label: '🎬 Twitter/X Video',  cmd:   `${p}twitter` },
          { kind: 'action', label: '🎵 TikTok Download',  cmd:   `${p}tiktok` },
        ], { quoted: m });
      } catch (_) { /* follow-up card is non-critical */ }
    });
  }
};
