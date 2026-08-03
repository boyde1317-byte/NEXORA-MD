/**
 * spotify.js — Spotify track downloader.
 *
 * Improvements:
 *  - DownloadProgress feedback (was silent for 5-15s)
 *  - Error handling with user-friendly message
 *  - Fixed cross-link button: only show YouTube Audio if track title exists
 *  - Album + duration metadata in follow-up card
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { spotifyDownload, isUrl } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

export default {
  name: 'spotify',
  aliases: ['sp', 'spdl'],
  category: 'download',
  description: 'Downloads a Spotify track as mp3. Usage: .spotify <track url>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const p   = prefix || '.';
    const url = args[0]?.trim();
    if (!url || !isUrl(url)) {
      return await m.reply.info(
        `Usage: \`${p}spotify <track url>\`\n\nExample: \`${p}spotify https://open.spotify.com/track/xxxxxx\``,
        'SPOTIFY DOWNLOADER'
      );
    }

    await withReactionStatus(m, async () => {
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start('Fetching Spotify track');
      try {
        const data = await spotifyDownload(url);
        await progress.done('✅ Got it! Sending audio...');

        await sock.sendMessage(m.from, {
          audio:    { url: data.url },
          mimetype: 'audio/mpeg',
        }, { quoted: m });

        // Follow-up interactive card with track metadata + actions
        try {
          const trackInfo = [
            data.title    ? `🎵 *${data.title}*`              : '🎵 Spotify Track',
            data.artist   ? `👤 ${data.artist}`                : null,
            data.album    ? `💿 ${data.album}`                 : null,
            data.duration ? `⏱️ ${data.duration}`              : null,
          ].filter(Boolean).join('\n');

          // Build follow-up buttons — only include YouTube cross-link if we have a title
          const buttons = [
            { kind: 'copy',   label: '📋 Copy Track URL',     value: url },
            { kind: 'url',    label: '🔗 Open on Spotify',     url:   url },
          ];
          if (data.title) {
            buttons.push({ kind: 'action', label: '🎵 Find on YouTube',  cmd: `${p}play ${data.title}` });
            buttons.push({ kind: 'action', label: '🎬 YouTube Video',    cmd: `${p}ytmp4 ${data.title}` });
          }

          await mixedCard(sock, m.from, {
            text:   `✅ *Track downloaded!*\n\n${trackInfo}`,
            footer: 'NEXORA-MD • Spotify Downloader',
          }, buttons, { quoted: m });
        } catch (_) {}
      } catch (err) {
        await progress.fail(`❌ Spotify download failed: ${err.message}`);
      }
    });
  }
};
