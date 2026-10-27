/**
 * spotify.js — Spotify track downloader.
 *
 * Improvements:
 *  - DownloadProgress feedback (was silent for 5-15s)
 *  - Error handling with user-friendly message
 *  - Fixed cross-link button: only show YouTube Audio if track title exists
 *  - Album + duration metadata in follow-up card
 */
import { withReactionStatus} from '../../lib/cosmetics.js';

import { spotifyDownload, isUrl, downloadMediaBuffer, whatsappAudioBuffer } from '../../lib/downloader.js';
import { DownloadProgress} from '../../lib/progress.js';

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

        // spotimate.io hands out a single-use token link; handing the raw URL
        // to baileys meant the fetch happened later and could already be gone.
        // Buffer it now, and never force 'audio/mpeg' onto unknown bytes.
        const raw = await downloadMediaBuffer(data.url, { timeoutMs: 90000 });
        const playable = await whatsappAudioBuffer(raw.buffer, raw.mimetype);

        await sock.sendMessage(m.from, {
          audio:    playable.buffer,
          mimetype: playable.mimetype,
          ptt: false,
        }, { quoted: m });
      } catch (err) {
        await m.reply.error(`Spotify download failed: ${err.message}`);
        throw err;
      }
    });
  }
};
