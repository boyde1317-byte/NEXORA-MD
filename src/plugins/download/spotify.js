/**
 * spotify.js — Spotify track downloader.
 *
 * Upgraded: adds mixedCard after download with track actions and related
 * downloader quick-reply buttons.
 */
import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { spotifyDownload, isUrl } from '../../lib/downloader.js';

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
      const data = await spotifyDownload(url);

      await sock.sendMessage(m.from, {
        audio:    { url: data.url },
        mimetype: 'audio/mpeg',
      }, { quoted: m });

      // Follow-up interactive card with track metadata + actions
      try {
        const trackInfo = [
          data.title  ? `🎵 *${data.title}*`              : null,
          data.artist ? `👤 ${data.artist}`                : null,
          data.album  ? `💿 ${data.album}`                 : null,
          data.duration ? `⏱️ ${data.duration}`            : null,
        ].filter(Boolean).join('\n') || '🎵 Spotify Track';

        await mixedCard(sock, m.from, {
          text:   `✅ *Track downloaded!*\n\n${trackInfo}`,
          footer: 'NEXORA-MD • Spotify Downloader',
        }, [
          { kind: 'copy',   label: '📋 Copy Track URL',     value: url },
          { kind: 'url',    label: '🔗 Open on Spotify',     url:   url },
          { kind: 'action', label: '🎵 YouTube Audio',       cmd:   `${p}play ${data.title || ''}`.trim() },
          { kind: 'action', label: '🎬 YouTube Video',       cmd:   `${p}ytmp4` },
        ], { quoted: m });
      } catch (_) { /* follow-up card is non-critical */ }
    });
  }
};
