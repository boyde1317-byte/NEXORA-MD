import { withReactionStatus } from '../../lib/cosmetics.js';
import { mixedCard, selectMenu } from '../../lib/interactiveKit.js';
import { youtubeSearch, youtubeDownload, isUrl } from '../../lib/downloader.js';
import { DownloadProgress } from '../../lib/progress.js';

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
        const progress = new DownloadProgress(sock, m.from, m);
        await progress.start('Downloading audio');
        try {
          const data = await youtubeDownload(query);
          if (!data.mp3) throw new Error('No audio stream available for that video.');
          await progress.done(`✅ ${data.title || 'Audio downloaded'}!`);

          const metaParts = [
            `🎵 *${data.title || 'YouTube Audio'}*`,
            data.author ? `👤 ${data.author}` : null,
            data.duration ? `⏱️ ${data.duration}` : null,
            data.views ? `👁️ ${data.views}` : null,
          ].filter(Boolean).join('\n');

          await sock.sendMessage(m.from, {
            audio: { url: data.mp3 },
            mimetype: 'audio/mpeg',
          }, { quoted: m });
          return await mixedCard(sock, m.from, {
            text: metaParts,
            footer: 'NEXORA-MD • YouTube Audio',
          }, [
            { kind: 'url',    label: '▶️ Watch on YouTube', url: query },
            { kind: 'action', label: '🎬 Get Video',        cmd: `${prefix}ytmp4 ${query}` },
            { kind: 'action', label: '📝 Get Lyrics',       cmd: `${prefix}lyrics ${data.title || query}` },
            { kind: 'action', label: '🎵 Play Another',     cmd: `${prefix}play` },
          ], { quoted: m });
        } catch (err) {
          await progress.fail(`Download failed: ${err.message}`);
          throw err;
        }
      }

      // Query — search and let the user pick.
      const progress = new DownloadProgress(sock, m.from, m);
      await progress.start(`Searching YouTube for "${query}"`);
      try {
        const results = (await youtubeSearch(query)).slice(0, MAX_RESULTS);
        await progress.done(`✅ Found ${results.length} results.`);

        // NOTE: carouselMessage (baileysBridge.sendCarousel) is NOT used here.
        // relayMessage resolves successfully even when the recipient's WA
        // client can't render carouselMessage — the failure only shows up
        // on their screen ("your version of WhatsApp doesn't support it"),
        // so a try/catch around sendCarousel never actually catches it.
        // selectMenu (buttonsMessage + single_select) is the reliable path.
        await selectMenu(sock, m.from, { text: `🔎 Results for "${query}":` }, '🎵 Pick a track', [
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
        await progress.fail(`Search failed: ${err.message}`);
        throw err;
      }
    });
  }
};
