import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard, selectMenu } from '../../lib/interactiveKit.js';
import { youtubeSearch, youtubeAudioBuffer, isUrl, whatsappAudioBuffer } from '../../lib/downloader.js';

const MAX_RESULTS = 5;

export default {
  name: 'play',
  aliases: ['yta', 'ytmp3', 'yts', 'ytsearch', 'youtubesearch'],
  category: 'download',
  description: 'Search & download YouTube audio. Usage: .play <song name or YouTube URL>',
  cooldown: 8000,
  execute: async ({ m, sock, args, prefix }) => {
    const query = args.join(' ').trim();
    if (!query) {
      return await m.reply.info(
        `Usage: \`${prefix}play <song name or YouTube URL>\`\n\nExample: \`${prefix}play maroon 5 memories\``,
        'PLAY MUSIC'
      );
    }

    await withReactionStatus(m, async () => {
      // Direct URL — resolve straight to audio.
      if (isUrl(query)) {
        try {
          // youtubeAudioBuffer downloads through yt-dlp and hands back a
          // finished mp3 — no short-lived CDN token to race, and no 60s
          // stall from fetching a googlevideo URL with plain HTTP.
          const audio = await youtubeAudioBuffer(query);

          const metaParts = [
            `🎵 *${audio.title || 'YouTube Audio'}*`,
            audio.author ? `👤 ${audio.author}` : null,
            audio.duration ? `⏱️ ${audio.duration}` : null,
          ].filter(Boolean).join('\n');

          // Anything that is not already an mp3 container gets re-encoded;
          // whatsappAudioBuffer passes audio/mpeg straight through.
          const playable = await whatsappAudioBuffer(audio.buffer, audio.mimetype);

          await sock.sendMessage(m.from, {
            audio: playable.buffer,
            mimetype: playable.mimetype,
            ptt: false,
          }, { quoted: m });

          return await mixedCard(sock, m.from, {
            text: metaParts,
            footer: 'NEXORA MD • YouTube Audio',
          }, [
            { kind: 'url',    label: '▶️ Watch on YouTube', url: query },
            { kind: 'action', label: '🎬 Get Video',        cmd: `${prefix}ytmp4 ${query}` },
            { kind: 'action', label: '📝 Get Lyrics',       cmd: `${prefix}lyrics ${audio.title || query}` },
            { kind: 'action', label: '🎵 Play Another',     cmd: `${prefix}play` },
          ], { quoted: m });
        } catch (err) {
          return await m.reply.error(`Couldn't download that audio: ${err.message}`);
        }
      }

      // Query — search and let the user pick. Single message (selectMenu).
      try {
        const results = (await youtubeSearch(query)).slice(0, MAX_RESULTS);

        // High-quality display image: first result's YouTube thumbnail
        // (hq720) as the card header, with its title as the header caption.
        // If it's missing, selectMenu falls back to the menu brand image.
        const top = results[0] || {};
        return await selectMenu(sock, m.from, {
          text: `🔎 Results for "${query}":`,
          title: (top.title || '').slice(0, 60) || 'YouTube Search',
          subtitle: [top.author, top.duration].filter(Boolean).join(' • '),
          thumbnail: top.thumbnail,
        }, '🎵 Pick a track', [
          {
            title: '🎵 Download Audio',
            rows: results.map((v, idx) => ({
              id: `${prefix}play ${v.url}`,
              title: `${idx + 1}. ${v.title}`.slice(0, 60),
              description: `${v.author || ''} • ${v.duration || ''}`,
            })),
          },
          {
            title: '🎬 Download Video',
            rows: results.map((v, idx) => ({
              id: `${prefix}ytmp4 ${v.url}`,
              title: `${idx + 1}. ${v.title}`.slice(0, 60),
              description: `${v.author || ''} • ${v.duration || ''}`,
            })),
          },
        ], [], { quoted: m });
      } catch (err) {
        return await m.reply.error(`Search failed: ${err.message}`);
      }
    });
  }
};
