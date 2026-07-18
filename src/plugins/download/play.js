import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard } from '../../lib/interactiveKit.js';
import { baileysBridge } from '../../core/baileysBridge.js';
import { youtubeSearch, youtubeDownload, isUrl } from '../../lib/downloader.js';

const MAX_RESULTS = 5;

export default {
  name: 'play',
  aliases: ['yta', 'ytmp3'],
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
        const data = await youtubeDownload(query);
        if (!data.mp3) throw new Error('No audio stream available for that video.');
        await sock.sendMessage(m.from, {
          audio: { url: data.mp3 },
          mimetype: 'audio/mpeg',
        }, { quoted: m });
        return await mixedCard(sock, m.from, {
          text: `🎵 *${data.title}*\n👤 ${data.author || 'Unknown'}`,
          footer: 'NEXORA-MD • YouTube Audio',
        }, [
          { kind: 'url', label: '▶️ Watch on YouTube', url: query },
          { kind: 'action', label: '🎬 Get Video', cmd: `${prefix}ytmp4 ${query}` },
        ], { quoted: m });
      }

      // Query — search and let the user pick.
      const results = (await youtubeSearch(query)).slice(0, MAX_RESULTS);
      const cards = results.map((v, idx) => ({
        caption: `🎵 *${v.title}*\n👤 ${v.author || 'Unknown'}\n⏱️ ${v.duration || '—'}`,
        footer: `Result ${idx + 1} of ${results.length}`,
        nativeFlow: [{ text: '🎵 Download Audio', id: `${prefix}play ${v.url}` }],
        ...(v.thumbnail ? { image: { url: v.thumbnail } } : {}),
      }));

      try {
        await baileysBridge.sendCarousel(sock, m.from, {
          text: `🔎 *Top results for:* "${query}"\nTap a card's button to download.`,
          cards,
        }, { quoted: m });
      } catch (err) {
        console.warn('[play] carousel failed, falling back to select menu:', err.message);
        const { selectMenu } = await import('../lib/interactiveKit.js');
        await selectMenu(sock, m.from, { text: `🔎 Results for "${query}":` }, '🎵 Pick a track', [{
          title: 'Search Results',
          rows: results.map((v, idx) => ({
            id: `${prefix}play ${v.url}`,
            title: `${idx + 1}. ${v.title}`.slice(0, 60),
            description: v.author || '',
          })),
        }], [], { quoted: m });
      }
    });
  }
};
